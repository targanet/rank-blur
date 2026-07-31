// Cole aqui a configuração do SEU projeto Firebase.
// Onde encontrar: console.firebase.google.com > seu projeto > ícone de engrenagem
// (Configurações do projeto) > aba "Geral" > role até "Seus apps" > app da Web (</>).
//
// Garanta que "databaseURL" está preenchido com a URL do Realtime Database
// (aparece na página Build > Realtime Database do console).
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyAQXeIhQkBPHIiuu7n-zDjIvUa954gksvA",
  authDomain: "blur-tracker.firebaseapp.com",
  databaseURL: "https://blur-tracker-default-rtdb.firebaseio.com",
  projectId: "blur-tracker",
  storageBucket: "blur-tracker.firebasestorage.app",
  messagingSenderId: "1097043875303",
  appId: "1:1097043875303:web:8fa6e86863e43b9d065942"
};

// E-mail da ÚNICA conta compartilhada pelo grupo (usada só para liberar edição
// no Control Panel). Não precisa ser um e-mail real — só precisa bater
// exatamente com o usuário que você criar em Authentication > Users no
// console do Firebase. A senha desse usuário é a "senha do grupo".
window.SHARED_LOGIN_EMAIL = "equipe@blur-tracker.local";
