import { toFrenchAuthMessage } from './auth-errors';

describe('toFrenchAuthMessage', () => {
  it('traduit des identifiants invalides', () => {
    expect(toFrenchAuthMessage({ message: 'Invalid login credentials' }))
      .toBe('Email ou mot de passe incorrect.');
  });

  it('traduit un email deja utilise', () => {
    expect(toFrenchAuthMessage({ message: 'User already registered' }))
      .toBe('Un compte existe deja avec cet email.');
  });

  it('traduit un email non confirme', () => {
    expect(toFrenchAuthMessage({ message: 'Email not confirmed' }))
      .toBe('Confirme ton email avant de te connecter.');
  });

  it('traduit un mot de passe trop court', () => {
    expect(toFrenchAuthMessage({ message: 'Password should be at least 8 characters' }))
      .toBe('Le mot de passe doit faire au moins 8 caracteres.');
  });

  it('traduit une panne reseau en invitant a continuer sans compte', () => {
    expect(toFrenchAuthMessage({ message: 'Failed to fetch' }))
      .toBe('Service indisponible, tu peux continuer sans compte.');
  });

  it('ne laisse jamais fuiter un message brut inconnu', () => {
    expect(toFrenchAuthMessage({ message: 'some internal postgres detail' }))
      .toBe('Une erreur est survenue, reessaie.');
  });

  it('gere une erreur nulle', () => {
    expect(toFrenchAuthMessage(null)).toBe('Une erreur est survenue, reessaie.');
  });
});
