/** Message lisible pour l'utilisateur (Firebase, API, etc.) */
export function formatAuthError(err: unknown): string {
  if (err && typeof err === 'object' && 'code' in err) {
    const code = String((err as { code: string }).code);
    const messages: Record<string, string> = {
      'auth/email-already-in-use':
        'Cet e-mail est déjà utilisé. Essayez de vous connecter, ou utilisez un autre e-mail.',
      'auth/invalid-email': 'Adresse e-mail invalide.',
      'auth/weak-password': 'Mot de passe trop faible (minimum 6 caractères).',
      'auth/invalid-credential': 'E-mail ou mot de passe incorrect.',
      'auth/too-many-requests': 'Trop de tentatives. Réessayez dans quelques minutes.',
      'auth/requires-recent-login':
        'Pour des raisons de sécurité, reconnectez-vous puis réessayez.',
      'auth/network-request-failed':
        'Le navigateur n’atteint pas Firebase (pas forcément votre Wi‑Fi).\n\n' +
        '1. Firebase Console → Authentication → Paramètres → Domaines autorisés → vérifiez que « localhost » est listé\n' +
        '2. Authentication → Méthode de connexion → E-mail/Mot de passe = Activé\n' +
        '3. Désactivez VPN, bloqueur de pub, extension privacy\n' +
        '4. Essayez Chrome ou Edge\n' +
        '5. Redémarrez : npm run dev',
    };
    if (messages[code]) return messages[code];
  }

  if (err instanceof Error) {
    if (err.message.includes('Firebase Admin')) {
      return 'Configuration serveur incorrecte. Vérifiez FIREBASE_CLIENT_EMAIL et FIREBASE_PRIVATE_KEY dans .env.local, puis redémarrez npm run dev.';
    }
    if (err.message.includes('DECODER') || err.message.includes('private key')) {
      return 'Clé privée Firebase invalide dans .env.local. Regénérez-la dans la console Firebase.';
    }
    if (err.message.includes('RESOURCE_EXHAUSTED') || err.message.includes('Quota exceeded')) {
      return (
        'Quota Firebase dépassé (plan gratuit). Le site ne peut plus écrire en base pour l’instant.\n\n' +
        '→ Firebase Console → votre projet → Firestore → Usage\n' +
        '→ Passez au plan Blaze (souvent gratuit au début) ou attendez le reset quotidien (minuit heure US).\n' +
        '→ Réduisez les tests répétés sur le marketplace en attendant.'
      );
    }
    return err.message;
  }

  if (typeof err === 'string') return err;
  return 'Une erreur est survenue. Réessayez.';
}
