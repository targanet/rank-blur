(function () {
  'use strict';

  var MAX_PHOTO_BYTES = 1.5 * 1024 * 1024;
  var db = null;
  var listeners = [];
  var currentData = { players: [], sessions: [] };
  var ready = false;
  var configured = !!(window.FIREBASE_CONFIG && window.FIREBASE_CONFIG.apiKey && window.FIREBASE_CONFIG.apiKey !== 'COLE_AQUI');

  function toArray(obj) {
    if (!obj) {
      return [];
    }
    return Object.keys(obj).map(function (key) {
      return Object.assign({ id: key }, obj[key]);
    });
  }

  function normalizeSession(session) {
    var scoresObj = session.scores || {};
    session.scores = Object.keys(scoresObj).map(function (playerId) {
      return { playerId: playerId, points: scoresObj[playerId] };
    });
    return session;
  }

  function initFirebase() {
    if (!configured) {
      showSetupBanner();
      return;
    }

    firebase.initializeApp(window.FIREBASE_CONFIG);
    db = firebase.database();

    db.ref('/').on('value', function (snapshot) {
      var val = snapshot.val() || {};
      currentData = {
        players: toArray(val.players),
        sessions: toArray(val.sessions).map(normalizeSession),
      };
      ready = true;
      listeners.forEach(function (cb) { cb(currentData); });
    }, function (err) {
      showToast('Erro de conexão', 'Não foi possível conectar ao Firebase: ' + err.message, true);
    });
  }

  function isAuthed() {
    try {
      return !!(configured && firebase.auth().currentUser);
    } catch (e) {
      return false;
    }
  }

  function onAuthChange(callback) {
    if (!configured) {
      callback(false);
      return;
    }
    try {
      firebase.auth().onAuthStateChanged(function (user) {
        callback(!!user);
      });
    } catch (e) {
      callback(false);
    }
  }

  function signIn(password) {
    if (!configured) {
      return Promise.reject(new Error('Firebase não configurado'));
    }
    var email = window.SHARED_LOGIN_EMAIL;
    return firebase.auth().signInWithEmailAndPassword(email, password);
  }

  function signOutUser() {
    return firebase.auth().signOut();
  }

  function showSetupBanner() {
    var banner = document.createElement('div');
    banner.className = 'toast toast-error';
    banner.style.maxWidth = '420px';
    banner.innerHTML = '<strong>Firebase não configurado</strong><span>Edite js/firebase-config.js com os dados do seu projeto Firebase para o site funcionar.</span>';
    document.body.appendChild(banner);
  }

  function onData(callback) {
    listeners.push(callback);
    if (ready) {
      callback(currentData);
    }
  }

  function requireDb() {
    if (!db) {
      throw new Error('Firebase não configurado');
    }
    return db;
  }

  function addPlayer(player) {
    var id = requireDb().ref('players').push().key;
    var payload = { name: player.name, bio: player.bio || null, photoDataUrl: player.photoDataUrl || null };
    return db.ref('players/' + id).set(payload).then(function () { return id; });
  }

  function updatePlayer(id, patch) {
    return requireDb().ref('players/' + id).update(patch);
  }

  function deletePlayer(id) {
    return requireDb().ref('/').once('value').then(function (snap) {
      var val = snap.val() || {};
      var updates = {};
      updates['players/' + id] = null;

      var sessions = val.sessions || {};
      Object.keys(sessions).forEach(function (sessionId) {
        var scores = sessions[sessionId].scores || {};
        if (scores[id] !== undefined) {
          updates['sessions/' + sessionId + '/scores/' + id] = null;
          var remaining = Object.keys(scores).filter(function (pid) { return pid !== id; });
          if (remaining.length === 0) {
            updates['sessions/' + sessionId] = null;
          }
        }
      });

      return db.ref('/').update(updates);
    });
  }

  function addSession(session) {
    var id = requireDb().ref('sessions').push().key;
    var scoresObj = {};
    session.scores.forEach(function (s) { scoresObj[s.playerId] = s.points; });
    return db.ref('sessions/' + id).set({ date: session.date, scores: scoresObj }).then(function () { return id; });
  }

  function deleteSession(id) {
    return requireDb().ref('sessions/' + id).remove();
  }

  function findPlayer(data, id) {
    for (var i = 0; i < data.players.length; i++) {
      if (data.players[i].id === id) {
        return data.players[i];
      }
    }
    return null;
  }

  function getLeaderboard(data) {
    return data.players
      .map(function (player) {
        var scores = [];
        data.sessions.forEach(function (session) {
          session.scores.forEach(function (score) {
            if (score.playerId === player.id) {
              scores.push(score);
            }
          });
        });

        var wins = data.sessions.filter(function (session) {
          if (session.scores.length === 0) {
            return false;
          }
          var max = Math.max.apply(null, session.scores.map(function (s) { return s.points; }));
          return max > 0 && session.scores.some(function (s) { return s.playerId === player.id && s.points === max; });
        }).length;

        var total = scores.reduce(function (sum, s) { return sum + s.points; }, 0);

        return {
          playerId: player.id,
          playerName: player.name,
          photoDataUrl: player.photoDataUrl,
          total: total,
          wins: wins,
          races: scores.length,
        };
      })
      .sort(function (a, b) {
        if (b.total !== a.total) {
          return b.total - a.total;
        }
        if (b.wins !== a.wins) {
          return b.wins - a.wins;
        }
        return a.playerName.localeCompare(b.playerName);
      });
  }

  function getSessionWinners(session) {
    var winners = {};
    if (session.scores.length === 0) {
      return winners;
    }
    var max = Math.max.apply(null, session.scores.map(function (s) { return s.points; }));
    if (max > 0) {
      session.scores.forEach(function (s) {
        if (s.points === max) {
          winners[s.playerId] = true;
        }
      });
    }
    return winners;
  }

  function formatDate(iso) {
    var d = new Date(iso + 'T00:00:00');
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
  }

  function renderHistoryHtml(data, opts) {
    opts = opts || {};
    var history = data.sessions.slice().sort(function (a, b) {
      return new Date(b.date) - new Date(a.date);
    });

    if (history.length === 0) {
      return emptyCard('calendar', 'No sessions recorded', 'Log your first race above');
    }

    var html = '';
    history.forEach(function (session) {
      var winners = getSessionWinners(session);
      html += '<div class="session-card">';
      html += '<div class="session-header"><div class="session-date-row">' + svg('calendar') +
        '<p class="session-date">' + formatDate(session.date) + '</p></div>';
      if (opts.showDelete) {
        html += '<button type="button" class="session-delete" data-session-id="' + session.id + '" aria-label="Excluir sessão">' + svg('trash') + '</button>';
      }
      html += '</div>';
      html += '<div class="session-scores">';

      var sortedScores = session.scores.slice().sort(function (a, b) { return b.points - a.points; });
      sortedScores.forEach(function (score) {
        var scorePlayer = findPlayer(data, score.playerId);
        var isWinner = !!winners[score.playerId];
        var name = scorePlayer ? scorePlayer.name : '';
        html += '<div class="session-score ' + (isWinner ? 'winner' : '') + '">';
        html += avatarHtml(name, scorePlayer && scorePlayer.photoDataUrl, 'session-score-avatar');
        html += '<div class="session-score-name-wrap"><p class="session-score-name">' + escapeHtml(name) + '</p>' +
          (isWinner ? starSvg('session-score-star') : '') + '</div>';
        html += '<p class="session-score-points">' + score.points + '</p>';
        html += '</div>';
      });

      html += '</div></div>';
    });
    return html;
  }

  function wireHistoryDeletes(container) {
    container.querySelectorAll('.session-delete').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (!confirm('Isso vai excluir permanentemente esta sessão de corrida. Esta ação não pode ser desfeita.')) {
          return;
        }
        var id = btn.getAttribute('data-session-id');
        deleteSession(id)
          .then(function () { showToast('Session Deleted', 'This race session was permanently deleted'); })
          .catch(function () { showToast('Erro', 'Failed to delete session', true); });
      });
    });
  }

  var ICONS = {
    trophy: '<path d="M10 14.66v1.626a2 2 0 0 1-.976 1.696A5 5 0 0 0 7 21.978"/><path d="M14 14.66v1.626a2 2 0 0 0 .976 1.696A5 5 0 0 1 17 21.978"/><path d="M18 9h1.5a1 1 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M6 9a6 6 0 0 0 12 0V3a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1z"/><path d="M6 9H4.5a1 1 0 0 1 0-5H6"/>',
    trending: '<path d="M16 7h6v6"/><path d="m22 7-8.5 8.5-5-5L2 17"/>',
    calendar: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
    trash: '<path d="M10 11v6"/><path d="M14 11v6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  };

  var STAR_PATH = '<path d="M12 2L15 8L22 9L17 14L18 21L12 18L6 21L7 14L2 9L9 8L12 2Z"/>';

  function svg(name, attrs) {
    attrs = attrs || '';
    return '<svg ' + attrs + ' viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + (ICONS[name] || '') + '</svg>';
  }

  function starSvg(cls) {
    return '<svg class="' + cls + '" viewBox="0 0 24 24" fill="currentColor">' + STAR_PATH + '</svg>';
  }

  function avatarHtml(name, photoDataUrl, cls) {
    cls = cls || '';
    if (photoDataUrl) {
      return '<span class="avatar ' + cls + '"><img src="' + photoDataUrl + '" alt="' + escapeHtml(name) + '" /></span>';
    }
    var initial = name ? name.charAt(0).toUpperCase() : '?';
    return '<span class="avatar ' + cls + '"><span class="avatar-fallback">' + escapeHtml(initial) + '</span></span>';
  }

  function emptyCard(icon, title, subtitle, extraClass) {
    return '<div class="empty-card ' + (extraClass || '') + '">' + svg(icon, 'class="empty-icon" width="' + (extraClass ? '36' : '40') + '" height="' + (extraClass ? '36' : '40') + '"') +
      '<span class="empty-title">' + title + '</span><span class="empty-subtitle">' + subtitle + '</span></div>';
  }

  function escapeHtml(value) {
    var div = document.createElement('div');
    div.textContent = value === null || value === undefined ? '' : String(value);
    return div.innerHTML;
  }

  function showToast(title, message, isError) {
    var existing = document.getElementById('app-toast');
    if (existing) {
      existing.remove();
    }
    var toast = document.createElement('div');
    toast.id = 'app-toast';
    toast.className = 'toast ' + (isError ? 'toast-error' : 'toast-success');
    toast.innerHTML = '<strong>' + escapeHtml(title) + '</strong>' + (message ? '<span>' + escapeHtml(message) + '</span>' : '');
    document.body.appendChild(toast);
    setTimeout(function () {
      toast.classList.add('toast-hide');
      setTimeout(function () { toast.remove(); }, 300);
    }, 3500);
  }

  function wirePhotoPickers(root) {
    (root || document).querySelectorAll('.photo-picker').forEach(function (picker) {
      var input = picker.querySelector('input[type="file"]');
      var circle = picker.querySelector('.photo-picker-circle');
      var img = picker.querySelector('img');
      if (!input || !circle || !img) {
        return;
      }

      input.addEventListener('change', function () {
        var file = input.files && input.files[0];
        if (!file) {
          return;
        }
        if (file.size > MAX_PHOTO_BYTES) {
          showToast('Erro', 'Foto muito grande (máx. 1.5MB)', true);
          input.value = '';
          return;
        }

        var reader = new FileReader();
        reader.onload = function (e) {
          img.src = e.target.result;
          circle.classList.add('has-image');
        };
        reader.readAsDataURL(file);
      });
    });
  }

  function wireDialogs(root) {
    (root || document).querySelectorAll('dialog.player-dialog').forEach(function (dialog) {
      if (dialog.dataset.wired) {
        return;
      }
      dialog.dataset.wired = 'true';
      dialog.addEventListener('click', function (e) {
        if (e.target === dialog) {
          dialog.close();
        }
      });
    });
  }

  function wireHeroVideo() {
    var frame = document.getElementById('hero-video-frame');
    var soundToggle = document.getElementById('hero-sound-toggle');
    var soundLabel = document.getElementById('hero-sound-label');
    if (!frame) {
      return;
    }

    if (window.location.protocol === 'file:') {
      var wrap = frame.parentElement;
      if (wrap) {
        wrap.innerHTML = '<p style="color:hsl(var(--muted-foreground));text-align:center;padding-top:8rem;font-family:var(--font-mono);">Abra este site por um servidor (não funciona ao abrir o arquivo direto).</p>';
      }
      if (soundToggle) {
        soundToggle.style.display = 'none';
      }
      return;
    }

    var videoId = '03cZRvxQC_I';
    var muted = true;
    var player = null;

    function loadYouTubeApi(callback) {
      if (window.YT && window.YT.Player) {
        callback();
        return;
      }
      if (!document.getElementById('youtube-iframe-api')) {
        var tag = document.createElement('script');
        tag.id = 'youtube-iframe-api';
        tag.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(tag);
      }
      var previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = function () {
        if (typeof previous === 'function') {
          previous();
        }
        callback();
      };
    }

    loadYouTubeApi(function () {
      player = new YT.Player(frame, {
        videoId: videoId,
        playerVars: {
          autoplay: 1,
          mute: 1,
          controls: 0,
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          disablekb: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: function (e) {
            // The API replaces #hero-video-frame with its own iframe; re-attach
            // the class so our fullscreen-cover CSS still applies to it.
            e.target.getIframe().classList.add('hero-video-frame');
          },
          onStateChange: function (e) {
            if (e.data === YT.PlayerState.ENDED) {
              player.seekTo(0);
              player.playVideo();
            }
          },
        },
      });
    });

    if (soundToggle) {
      soundToggle.addEventListener('click', function () {
        if (!player) {
          return;
        }
        muted = !muted;
        if (muted) {
          player.mute();
        } else {
          player.unMute();
        }
        soundToggle.setAttribute('aria-pressed', String(!muted));
        if (soundLabel) {
          soundLabel.textContent = muted ? 'ATIVAR SOM' : 'SILENCIAR';
        }
      });
    }
  }

  // Runs immediately (not on DOMContentLoaded) so firebase.initializeApp()
  // has already happened before manage.js/home.js execute their top-level
  // code right after this script tag (they run synchronously, before
  // DOMContentLoaded fires).
  initFirebase();

  document.addEventListener('DOMContentLoaded', function () {
    wireHeroVideo();
  });

  window.RankBlur = {
    onData: onData,
    isAuthed: isAuthed,
    onAuthChange: onAuthChange,
    signIn: signIn,
    signOutUser: signOutUser,
    addPlayer: addPlayer,
    updatePlayer: updatePlayer,
    deletePlayer: deletePlayer,
    addSession: addSession,
    deleteSession: deleteSession,
    findPlayer: findPlayer,
    getLeaderboard: getLeaderboard,
    getSessionWinners: getSessionWinners,
    renderHistoryHtml: renderHistoryHtml,
    wireHistoryDeletes: wireHistoryDeletes,
    svg: svg,
    starSvg: starSvg,
    avatarHtml: avatarHtml,
    emptyCard: emptyCard,
    escapeHtml: escapeHtml,
    showToast: showToast,
    wirePhotoPickers: wirePhotoPickers,
    wireDialogs: wireDialogs,
    MAX_PHOTO_BYTES: MAX_PHOTO_BYTES,
  };
})();
