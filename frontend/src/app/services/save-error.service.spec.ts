import { TestBed } from '@angular/core/testing';
import { SaveErrorService } from './save-error.service';

describe('SaveErrorService', () => {
  let service: SaveErrorService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [SaveErrorService] });
    service = TestBed.inject(SaveErrorService);
  });

  it('ne signale rien au depart', () => {
    expect(service.message()).toBeNull();
  });

  it('expose le message de la derniere sauvegarde echouee', () => {
    service.reportFailure();
    expect(service.message()).toBe(
      'Sauvegarde impossible : service indisponible. Tes modifications ne sont pas enregistrees.'
    );
  });

  it('peut etre acquitte', () => {
    service.reportFailure();
    service.dismiss();
    expect(service.message()).toBeNull();
  });
});
