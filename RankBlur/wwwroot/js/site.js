document.addEventListener('DOMContentLoaded', function () {
  var toast = document.getElementById('app-toast');
  if (toast) {
    setTimeout(function () {
      toast.classList.add('toast-hide');
      setTimeout(function () {
        toast.remove();
      }, 300);
    }, 3500);
  }

  document.querySelectorAll('.photo-picker').forEach(function (picker) {
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

      var reader = new FileReader();
      reader.onload = function (e) {
        img.src = e.target.result;
        circle.classList.add('has-image');
      };
      reader.readAsDataURL(file);
    });
  });

  document.querySelectorAll('dialog.player-dialog').forEach(function (dialog) {
    dialog.addEventListener('click', function (e) {
      if (e.target === dialog) {
        dialog.close();
      }
    });
  });

  var heroVideo = document.getElementById('hero-video-frame');
  var soundToggle = document.getElementById('hero-sound-toggle');
  var soundLabel = document.getElementById('hero-sound-label');
  if (heroVideo && soundToggle) {
    var muted = true;

    function postToPlayer(func) {
      heroVideo.contentWindow.postMessage(JSON.stringify({ event: 'command', func: func, args: [] }), '*');
    }

    soundToggle.addEventListener('click', function () {
      muted = !muted;
      postToPlayer(muted ? 'mute' : 'unMute');
      soundToggle.setAttribute('aria-pressed', String(!muted));
      if (soundLabel) {
        soundLabel.textContent = muted ? 'ATIVAR SOM' : 'SILENCIAR';
      }
    });
  }
});
