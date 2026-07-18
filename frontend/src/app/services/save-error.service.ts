import { Injectable, signal } from '@angular/core';

const MESSAGE =
  'Sauvegarde impossible : service indisponible. Tes modifications ne sont pas enregistrees.';

/**
 * Signale a l'utilisateur qu'une ecriture a echoue.
 *
 * Les lectures ont un repli (le miroir local), pas les ecritures : une sauvegarde qui
 * echoue DOIT etre visible, sinon l'utilisateur croit son travail enregistre alors que
 * rien n'est parti.
 */
@Injectable({ providedIn: 'root' })
export class SaveErrorService {
  private readonly _message = signal<string | null>(null);
  readonly message = this._message.asReadonly();

  reportFailure(): void {
    this._message.set(MESSAGE);
  }

  dismiss(): void {
    this._message.set(null);
  }
}
