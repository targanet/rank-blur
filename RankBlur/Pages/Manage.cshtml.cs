using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using RankBlur.Services;

namespace RankBlur.Pages;

public class ManageModel : PageModel
{
    private const long MaxPhotoBytes = 3 * 1024 * 1024;

    private readonly RankingService _rankingService;

    public ManageModel(RankingService rankingService)
    {
        _rankingService = rankingService;
    }

    [BindProperty]
    public string NewPlayerName { get; set; } = string.Empty;

    [BindProperty]
    public string? NewPlayerBio { get; set; }

    [BindProperty]
    public IFormFile? NewPlayerPhoto { get; set; }

    [BindProperty]
    public RankingSession NewSession { get; set; } = new()
    {
        Date = DateOnly.FromDateTime(DateTime.Today),
    };

    public IReadOnlyList<Player> Players => _rankingService.Players;
    public IReadOnlyList<RankingSession> History => _rankingService.Sessions.OrderByDescending(s => s.Date).ToList();
    public Dictionary<Guid, LeaderboardEntry> Stats => _rankingService.GetLeaderboard().ToDictionary(e => e.PlayerId);

    [TempData]
    public string? ToastTitle { get; set; }

    [TempData]
    public string? ToastMessage { get; set; }

    [TempData]
    public bool ToastIsError { get; set; }

    public void OnGet()
    {
        PrepareNewSession();
    }

    public async Task<IActionResult> OnPostAddPlayerAsync()
    {
        if (string.IsNullOrWhiteSpace(NewPlayerName))
        {
            SetToast("Erro", "O nome não pode ficar vazio", isError: true);
            return RedirectToPage();
        }

        try
        {
            var photoDataUrl = await ToDataUrlAsync(NewPlayerPhoto);
            _rankingService.AddPlayer(NewPlayerName, NewPlayerBio, photoDataUrl);
            SetToast("Jogador adicionado", $"{NewPlayerName.Trim()} entrou no elenco");
        }
        catch
        {
            SetToast("Erro", "Falha ao adicionar jogador", isError: true);
        }

        return RedirectToPage();
    }

    public async Task<IActionResult> OnPostUpdatePlayerAsync(Guid id, string name, string? bio, IFormFile? photo)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            SetToast("Erro", "O nome não pode ficar vazio", isError: true);
            return RedirectToPage();
        }

        try
        {
            var photoDataUrl = await ToDataUrlAsync(photo);
            var updated = _rankingService.UpdatePlayer(id, name, bio, photoDataUrl);
            SetToast(updated ? "Jogador atualizado" : "Erro", updated ? "Alterações salvas" : "Falha ao atualizar jogador", isError: !updated);
        }
        catch
        {
            SetToast("Erro", "Falha ao atualizar jogador", isError: true);
        }

        return RedirectToPage();
    }

    public IActionResult OnPostDeletePlayer(Guid id)
    {
        var player = _rankingService.GetPlayer(id);
        var removed = _rankingService.DeletePlayer(id);
        SetToast(removed ? "Jogador removido" : "Erro",
            removed ? $"{player?.Name} foi excluído do elenco" : "Falha ao excluir jogador",
            isError: !removed);
        return RedirectToPage();
    }

    public IActionResult OnPostAddSession()
    {
        if (Players.Count == 0)
        {
            SetToast("No Players", "Add players first before logging a session", isError: true);
            return RedirectToPage();
        }

        var scores = NewSession.Scores
            .Where(s => Players.Any(p => p.Id == s.PlayerId))
            .ToList();

        if (scores.Any(s => s.Points < 0 || s.Points > 100))
        {
            SetToast("Invalid Scores", "All scores must be between 0 and 100", isError: true);
            return RedirectToPage();
        }

        if (!scores.Any(s => s.Points > 0))
        {
            SetToast("Invalid Session", "At least one player must have a non-zero score", isError: true);
            return RedirectToPage();
        }

        _rankingService.LogSession(new RankingSession
        {
            Date = NewSession.Date,
            Scores = scores,
        });

        SetToast("Session Logged", "Race results saved successfully");
        return RedirectToPage();
    }

    private void PrepareNewSession()
    {
        NewSession.Date = DateOnly.FromDateTime(DateTime.Today);
        NewSession.Scores = Players.Select(p => new ScoreEntry { PlayerId = p.Id, Points = 0 }).ToList();
    }

    private void SetToast(string title, string message, bool isError = false)
    {
        ToastTitle = title;
        ToastMessage = message;
        ToastIsError = isError;
    }

    private static async Task<string?> ToDataUrlAsync(IFormFile? photo)
    {
        if (photo is null || photo.Length == 0)
        {
            return null;
        }

        if (photo.Length > MaxPhotoBytes || !photo.ContentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("Invalid photo");
        }

        using var stream = new MemoryStream();
        await photo.CopyToAsync(stream);
        var base64 = Convert.ToBase64String(stream.ToArray());
        return $"data:{photo.ContentType};base64,{base64}";
    }
}
