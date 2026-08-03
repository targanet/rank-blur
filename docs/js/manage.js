(function () {
  var RB = window.RankBlur;
  var latestData = { players: [], sessions: [] };

  var footerYear = document.getElementById('footer-year');
  if (footerYear) {
    footerYear.textContent = String(new Date().getFullYear());
  }

  var loginGate = document.getElementById('login-gate');
  var manageContent = document.getElementById('manage-content');
  var authStatus = document.getElementById('auth-status');
  var loginForm = document.getElementById('login-form');

  RB.onAuthChange(function (authed) {
    loginGate.style.display = authed ? 'none' : '';
    manageContent.style.display = authed ? '' : 'none';
    authStatus.innerHTML = authed
      ? 'CONTROL PANEL &middot; <a href="#" id="logout-link" style="color:inherit;text-decoration:underline;">SAIR</a>'
      : 'CONTROL PANEL';

    var logoutLink = document.getElementById('logout-link');
    if (logoutLink) {
      logoutLink.addEventListener('click', function (e) {
        e.preventDefault();
        RB.signOutUser();
      });
    }
  });

  loginForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var password = document.getElementById('login-password').value;
    if (!password) {
      return;
    }
    RB.signIn(password)
      .then(function () {
        document.getElementById('login-password').value = '';
      })
      .catch(function () {
        RB.showToast('Erro', 'Senha incorreta', true);
      });
  });

  RB.onData(function (data) {
    latestData = data;
    renderLogSession(data);
    renderParticipants(data);
    renderRaceHistory(data);
  });

  function todayIso() {
    var d = new Date();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + day;
  }

  function renderLogSession(data) {
    var panel = document.getElementById('log-session-panel');
    if (data.players.length === 0) {
      panel.innerHTML = RB.emptyCard('plus', 'No players registered', 'Add players in the section below first');
      return;
    }

    var html = '<form id="session-form" class="session-form">';
    html += '<label>Race Date<input type="date" id="session-date" value="' + todayIso() + '" /></label>';
    html += '<p class="empty-subtitle" style="text-transform:uppercase;letter-spacing:.06rem;margin:.4rem 0 0;">Player Scores (0-100)</p>';
    html += '<div class="score-grid">';
    data.players.forEach(function (p) {
      html += '<div class="score-row"><span class="score-name">' + RB.escapeHtml(p.name) +
        '</span><input type="number" min="0" max="100" value="0" data-player-id="' + p.id + '" class="score-input" /></div>';
    });
    html += '</div>';
    html += '<div class="actions"><button type="submit" class="outline-btn">SALVAR SESSÃO</button></div>';
    html += '</form>';
    panel.innerHTML = html;

    document.getElementById('session-form').addEventListener('submit', function (e) {
      e.preventDefault();

      var dateVal = document.getElementById('session-date').value || todayIso();
      var scores = [];
      panel.querySelectorAll('.score-input').forEach(function (input) {
        var points = parseInt(input.value, 10);
        if (isNaN(points)) {
          points = 0;
        }
        scores.push({ playerId: input.getAttribute('data-player-id'), points: points });
      });

      if (scores.some(function (s) { return s.points < 0 || s.points > 100; })) {
        RB.showToast('Invalid Scores', 'All scores must be between 0 and 100', true);
        return;
      }
      if (!scores.some(function (s) { return s.points > 0; })) {
        RB.showToast('Invalid Session', 'At least one player must have a non-zero score', true);
        return;
      }

      RB.addSession({ date: dateVal, scores: scores })
        .then(function () { RB.showToast('Session Logged', 'Race results saved successfully'); })
        .catch(function () { RB.showToast('Erro', 'Não foi possível salvar a sessão', true); });
    });
  }

  function renderParticipants(data) {
    var panel = document.getElementById('participants-panel');
    var html = '';

    if (data.players.length === 0) {
      html += RB.emptyCard('users', 'Nenhum participante', 'Adicione o primeiro piloto abaixo', 'nested');
    } else {
      var leaderboard = RB.getLeaderboard(data);
      var statsById = {};
      leaderboard.forEach(function (l) { statsById[l.playerId] = l; });

      html += '<ul class="player-list">';
      data.players.forEach(function (player) {
        var stats = statsById[player.id] || { total: 0, wins: 0 };
        html += '<li class="player-item">';
        html += '<div class="player-summary">' + RB.avatarHtml(player.name, player.photoDataUrl, '') +
          '<span class="player-name">' + RB.escapeHtml(player.name) + '</span>' +
          '<span class="player-stats">' + stats.total + ' pts &middot; ' + stats.wins + ' wins</span></div>';
        html += '<details class="player-details"><summary>Ver perfil</summary>';
        if (player.bio) {
          html += '<p class="player-bio">' + RB.escapeHtml(player.bio) + '</p>';
        }
        html += editPlayerForm(player);
        html += '<form class="delete-player-form" data-player-id="' + player.id + '"><div class="actions"><button type="submit" class="danger-btn">EXCLUIR JOGADOR</button></div></form>';
        html += '</details>';
        html += '</li>';
      });
      html += '</ul>';
    }

    html += '<details class="add-player-toggle">';
    html += '<summary class="outline-btn full-width">' + RB.svg('plus', 'width="16" height="16"') + 'ADICIONAR PARTICIPANTE</summary>';
    html += addPlayerForm();
    html += '</details>';

    panel.innerHTML = html;

    RB.wirePhotoPickers(panel);

    var addForm = document.getElementById('add-player-form');
    if (addForm) {
      addForm.addEventListener('submit', function (e) {
        e.preventDefault();
        handleAddPlayer(addForm);
      });
    }

    panel.querySelectorAll('.edit-player-form').forEach(function (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        handleUpdatePlayer(form);
      });
    });

    panel.querySelectorAll('.delete-player-form').forEach(function (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var id = form.getAttribute('data-player-id');
        var player = RB.findPlayer(latestData, id);
        if (!confirm('Isso vai excluir ' + (player ? player.name : '') + ' permanentemente. Esta ação não pode ser desfeita.')) {
          return;
        }
        handleDeletePlayer(id, player ? player.name : '');
      });
    });
  }

  function renderRaceHistory(data) {
    var panel = document.getElementById('race-history-panel');
    panel.innerHTML = RB.renderHistoryHtml(data, { showDelete: true });
    RB.wireHistoryDeletes(panel);
  }

  function addPlayerForm() {
    return '' +
      '<form id="add-player-form" class="player-form">' +
      photoPickerHtml('new-player-photo', null) +
      '<div class="field"><label for="new-player-name">Nome do jogador</label><input id="new-player-name" placeholder="Nome do jogador" /></div>' +
      '<div class="field"><label for="new-player-bio">Informações (opcional)</label><textarea id="new-player-bio" rows="3" placeholder="Apelido, estilo de jogo, etc."></textarea></div>' +
      '<div class="actions"><button type="submit" class="primary-btn">SALVAR</button></div>' +
      '</form>';
  }

  function editPlayerForm(player) {
    return '' +
      '<form class="edit-player-form player-form inline-form" data-player-id="' + player.id + '">' +
      photoPickerHtml('edit-photo-' + player.id, player.photoDataUrl) +
      '<div class="field"><label>Nome do jogador</label><input class="edit-name" value="' + RB.escapeHtml(player.name) + '" placeholder="Nome do jogador" /></div>' +
      '<div class="field"><label>Informações (opcional)</label><textarea class="edit-bio" rows="3" placeholder="Apelido, estilo de jogo, etc.">' + RB.escapeHtml(player.bio || '') + '</textarea></div>' +
      '<div class="actions"><button type="submit" class="secondary-btn">SALVAR</button></div>' +
      '</form>';
  }

  function photoPickerHtml(inputId, existingPhoto) {
    var hasImage = existingPhoto ? ' has-image' : '';
    return '' +
      '<div class="photo-picker">' +
      '<label class="photo-picker-circle' + hasImage + '" for="' + inputId + '">' +
      '<span class="photo-picker-placeholder">Clique para escolher uma foto</span>' +
      '<img src="' + (existingPhoto || '') + '" alt="" />' +
      '</label>' +
      '<input id="' + inputId + '" type="file" accept="image/*" class="photo-input" />' +
      '<span class="photo-picker-label">Foto (opcional)</span>' +
      '</div>';
  }

  function readPhoto(input, callback) {
    var file = input.files && input.files[0];
    if (!file) {
      callback(null);
      return;
    }
    if (file.size > RB.MAX_PHOTO_BYTES) {
      RB.showToast('Erro', 'Foto muito grande (máx. 1.5MB)', true);
      callback(undefined);
      return;
    }

    var reader = new FileReader();
    reader.onload = function (e) { callback(e.target.result); };
    reader.readAsDataURL(file);
  }

  function handleAddPlayer(form) {
    var name = form.querySelector('#new-player-name').value.trim();
    if (!name) {
      RB.showToast('Erro', 'O nome não pode ficar vazio', true);
      return;
    }
    var bio = form.querySelector('#new-player-bio').value.trim();
    var photoInput = form.querySelector('.photo-input');

    readPhoto(photoInput, function (photoDataUrl) {
      if (photoDataUrl === undefined) {
        return;
      }
      RB.addPlayer({ name: name, bio: bio || null, photoDataUrl: photoDataUrl || null })
        .then(function () { RB.showToast('Jogador adicionado', name + ' entrou no elenco'); })
        .catch(function () { RB.showToast('Erro', 'Falha ao adicionar jogador', true); });
    });
  }

  function handleUpdatePlayer(form) {
    var id = form.getAttribute('data-player-id');
    var name = form.querySelector('.edit-name').value.trim();
    if (!name) {
      RB.showToast('Erro', 'O nome não pode ficar vazio', true);
      return;
    }
    var bio = form.querySelector('.edit-bio').value.trim();
    var photoInput = form.querySelector('.photo-input');

    readPhoto(photoInput, function (photoDataUrl) {
      if (photoDataUrl === undefined) {
        return;
      }
      var patch = { name: name, bio: bio || null };
      if (photoDataUrl) {
        patch.photoDataUrl = photoDataUrl;
      }
      RB.updatePlayer(id, patch)
        .then(function () { RB.showToast('Jogador atualizado', 'Alterações salvas'); })
        .catch(function () { RB.showToast('Erro', 'Falha ao atualizar jogador', true); });
    });
  }

  function handleDeletePlayer(id, name) {
    RB.deletePlayer(id)
      .then(function () { RB.showToast('Jogador removido', name + ' foi excluído do elenco'); })
      .catch(function () { RB.showToast('Erro', 'Falha ao excluir jogador', true); });
  }
})();
