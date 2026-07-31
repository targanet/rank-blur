using System.Collections.Generic;
using System.Linq;
using System.Text.Json;

namespace RankBlur.Services;

public sealed class Player
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public string Name { get; set; } = string.Empty;
    public string? Bio { get; set; }
    public string? PhotoDataUrl { get; set; }
}

public sealed class ScoreEntry
{
    public Guid PlayerId { get; set; }
    public int Points { get; set; }
}

public sealed class RankingSession
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public DateOnly Date { get; set; }
    public List<ScoreEntry> Scores { get; set; } = new();
}

public sealed class LeaderboardEntry
{
    public Guid PlayerId { get; init; }
    public string PlayerName { get; init; } = string.Empty;
    public string? PhotoDataUrl { get; init; }
    public int Total { get; init; }
    public int Wins { get; init; }
    public int Races { get; init; }
}

public sealed class RankingService
{
    private readonly string _dataFilePath;
    private readonly List<Player> _players = new();
    private readonly List<RankingSession> _sessions = new();

    public RankingService(string dataFilePath)
    {
        _dataFilePath = dataFilePath;
        Load();
    }

    public IReadOnlyList<Player> Players => _players.AsReadOnly();
    public IReadOnlyList<RankingSession> Sessions => _sessions.AsReadOnly();

    public Player? GetPlayer(Guid id) => _players.FirstOrDefault(p => p.Id == id);

    public Player AddPlayer(string name, string? bio, string? photoDataUrl)
    {
        var player = new Player
        {
            Name = name.Trim(),
            Bio = string.IsNullOrWhiteSpace(bio) ? null : bio.Trim(),
            PhotoDataUrl = photoDataUrl,
        };
        _players.Add(player);
        Save();
        return player;
    }

    public bool UpdatePlayer(Guid id, string name, string? bio, string? photoDataUrl)
    {
        var player = GetPlayer(id);
        if (player is null)
        {
            return false;
        }

        player.Name = name.Trim();
        player.Bio = string.IsNullOrWhiteSpace(bio) ? null : bio.Trim();
        if (photoDataUrl is not null)
        {
            player.PhotoDataUrl = photoDataUrl;
        }

        Save();
        return true;
    }

    public bool DeletePlayer(Guid id)
    {
        var player = GetPlayer(id);
        if (player is null)
        {
            return false;
        }

        _players.Remove(player);
        foreach (var session in _sessions)
        {
            session.Scores.RemoveAll(s => s.PlayerId == id);
        }
        _sessions.RemoveAll(s => s.Scores.Count == 0);

        Save();
        return true;
    }

    public void LogSession(RankingSession session)
    {
        _sessions.Add(session);
        Save();
    }

    public bool DeleteSession(Guid id)
    {
        var removed = _sessions.RemoveAll(s => s.Id == id) > 0;
        if (removed)
        {
            Save();
        }

        return removed;
    }

    public List<LeaderboardEntry> GetLeaderboard()
    {
        return _players
            .Select(player =>
            {
                var scores = _sessions.SelectMany(s => s.Scores).Where(s => s.PlayerId == player.Id).ToList();
                var wins = _sessions.Count(s =>
                {
                    if (s.Scores.Count == 0)
                    {
                        return false;
                    }

                    var max = s.Scores.Max(sc => sc.Points);
                    return max > 0 && s.Scores.Any(sc => sc.PlayerId == player.Id && sc.Points == max);
                });

                return new LeaderboardEntry
                {
                    PlayerId = player.Id,
                    PlayerName = player.Name,
                    PhotoDataUrl = player.PhotoDataUrl,
                    Total = scores.Sum(s => s.Points),
                    Wins = wins,
                    Races = scores.Count,
                };
            })
            .OrderByDescending(r => r.Total)
            .ThenByDescending(r => r.Wins)
            .ThenBy(r => r.PlayerName, StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    public HashSet<Guid> GetSessionWinners(RankingSession session)
    {
        if (session.Scores.Count == 0)
        {
            return new HashSet<Guid>();
        }

        var max = session.Scores.Max(s => s.Points);
        return max > 0
            ? session.Scores.Where(s => s.Points == max).Select(s => s.PlayerId).ToHashSet()
            : new HashSet<Guid>();
    }

    private sealed class PersistedData
    {
        public List<Player> Players { get; set; } = new();
        public List<RankingSession> Sessions { get; set; } = new();
    }

    private void Load()
    {
        if (!File.Exists(_dataFilePath))
        {
            return;
        }

        try
        {
            var json = File.ReadAllText(_dataFilePath);
            var data = JsonSerializer.Deserialize<PersistedData>(json);
            if (data is null)
            {
                return;
            }

            _players.AddRange(data.Players);
            _sessions.AddRange(data.Sessions);
        }
        catch (JsonException)
        {
            // Corrupt or unreadable data file: start fresh rather than crash the app.
        }
    }

    private void Save()
    {
        var directory = Path.GetDirectoryName(_dataFilePath);
        if (!string.IsNullOrEmpty(directory))
        {
            Directory.CreateDirectory(directory);
        }

        var data = new PersistedData { Players = _players, Sessions = _sessions };
        var json = JsonSerializer.Serialize(data, new JsonSerializerOptions { WriteIndented = true });
        File.WriteAllText(_dataFilePath, json);
    }
}
