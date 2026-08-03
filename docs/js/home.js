(function () {
  var RB = window.RankBlur;

  var footerYear = document.getElementById('footer-year');
  if (footerYear) {
    footerYear.textContent = String(new Date().getFullYear());
  }

  RB.onData(function (data) {
    renderLeaderboard(data);
    renderHistory(data);
    RB.wireDialogs();
  });

  function renderLeaderboard(data) {
    var panel = document.getElementById('leaderboard-panel');
    var leaderboard = RB.getLeaderboard(data);
    if (leaderboard.length === 0) {
      panel.innerHTML = RB.emptyCard('trophy', 'No races recorded yet', 'Log your first session to get started');
      return;
    }

    var html = '<div class="leaderboard-list">';
    leaderboard.forEach(function (item, index) {
      var rank = index + 1;
      var rankClass = rank <= 3 ? 'lb-rank-' + rank : '';
      var player = RB.findPlayer(data, item.playerId);
      var dialogId = 'player-dialog-' + item.playerId;

      html += '<div class="lb-card ' + rankClass + '">';
      html += '<div class="lb-badge">' + rank + '</div>';
      html += '<button type="button" class="lb-avatar-link" title="Ver perfil" onclick="document.getElementById(\'' + dialogId + '\').showModal()">' +
        RB.avatarHtml(item.playerName, item.photoDataUrl, 'lb-avatar') + '</button>';
      html += playerDialog(item, player, dialogId);
      html += '<div class="lb-info"><div class="lb-name-row"><h3 class="lb-name">' + RB.escapeHtml(item.playerName) + '</h3>' +
        (rank === 1 ? RB.starSvg('lb-star') : '') + '</div><p class="lb-races">' + item.races + ' ' + (item.races === 1 ? 'race' : 'races') + '</p></div>';
      html += '<div class="lb-stats">';
      html += '<div class="lb-stat"><div class="lb-stat-label wins">' + RB.svg('trophy') + 'WINS</div><p class="lb-stat-value primary">' + item.wins + '</p></div>';
      html += '<div class="lb-stat"><div class="lb-stat-label total">' + RB.svg('trending') + 'TOTAL</div><p class="lb-stat-value neon">' + item.total + '</p></div>';
      html += '</div>';
      html += '</div>';
    });
    html += '</div>';
    panel.innerHTML = html;
  }

  function playerDialog(item, player, dialogId) {
    var bio = player && player.bio
      ? '<p class="player-dialog-bio">' + RB.escapeHtml(player.bio) + '</p>'
      : '<p class="player-dialog-bio muted">Nenhuma informação cadastrada</p>';
    var photo = item.photoDataUrl
      ? '<img src="' + item.photoDataUrl + '" alt="' + RB.escapeHtml(item.playerName) + '" />'
      : '<span class="avatar-fallback big">' + RB.escapeHtml(item.playerName.charAt(0).toUpperCase()) + '</span>';

    return '' +
      '<dialog id="' + dialogId + '" class="player-dialog">' +
      '<form method="dialog"><button class="player-dialog-close" aria-label="Fechar">' + RB.svg('close', 'width="18" height="18"') + '</button></form>' +
      '<div class="player-dialog-photo">' + photo + '</div>' +
      '<h3 class="player-dialog-name">' + RB.escapeHtml(item.playerName) + '</h3>' +
      bio +
      '<div class="player-dialog-stats">' +
      '<div class="lb-stat"><div class="lb-stat-label">WINS</div><p class="lb-stat-value primary">' + item.wins + '</p></div>' +
      '<div class="lb-stat"><div class="lb-stat-label">TOTAL</div><p class="lb-stat-value neon">' + item.total + '</p></div>' +
      '<div class="lb-stat"><div class="lb-stat-label">RACES</div><p class="lb-stat-value">' + item.races + '</p></div>' +
      '</div>' +
      '</dialog>';
  }

  function renderHistory(data) {
    var panel = document.getElementById('history-panel');
    panel.innerHTML = RB.renderHistoryHtml(data, { showDelete: false });
  }
})();
