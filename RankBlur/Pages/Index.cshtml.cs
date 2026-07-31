using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using RankBlur.Services;

namespace RankBlur.Pages;

public class IndexModel : PageModel
{
    private readonly RankingService _rankingService;

    public IndexModel(RankingService rankingService)
    {
        _rankingService = rankingService;
    }

    public IReadOnlyList<LeaderboardEntry> Leaderboard => _rankingService.GetLeaderboard();
    public IReadOnlyList<RankingSession> History => _rankingService.Sessions.OrderByDescending(s => s.Date).ToList();
    public IReadOnlyList<Player> Players => _rankingService.Players;

    public Player? PlayerOf(Guid id) => _rankingService.GetPlayer(id);
    public HashSet<Guid> WinnersOf(RankingSession session) => _rankingService.GetSessionWinners(session);

    [TempData]
    public string? ToastTitle { get; set; }

    [TempData]
    public string? ToastMessage { get; set; }

    [TempData]
    public bool ToastIsError { get; set; }

    public void OnGet()
    {
    }

    public IActionResult OnPostDeleteSession(Guid id)
    {
        var removed = _rankingService.DeleteSession(id);
        ToastTitle = removed ? "Session Deleted" : "Erro";
        ToastMessage = removed ? "This race session was permanently deleted" : "Failed to delete session";
        ToastIsError = !removed;
        return RedirectToPage();
    }
}
