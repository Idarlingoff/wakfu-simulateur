import { TestBed } from '@angular/core/testing';
import { throwError } from 'rxjs';
import { BuildService } from './build.service';
import { WakfuApiService } from './wakfu-api.service';
import { SaveErrorService } from './save-error.service';
import { Build } from '../models/build.model';

const build = { id: 'b1', name: 'test', classId: 'XEL' } as unknown as Build;

function configure() {
  const api = {
    getAllBuilds: () => throwError(() => new Error('offline')),
    createBuild: () => throwError(() => new Error('offline')),
    updateBuild: () => throwError(() => new Error('offline')),
    deleteBuild: () => throwError(() => new Error('offline')),
    getBuildById: () => throwError(() => new Error('offline')),
  };
  TestBed.configureTestingModule({
    providers: [BuildService, SaveErrorService, { provide: WakfuApiService, useValue: api }],
  });
  return {
    service: TestBed.inject(BuildService),
    saveError: TestBed.inject(SaveErrorService),
  };
}

describe('BuildService — echecs d ecriture', () => {
  // Sans ca, l'utilisateur croit avoir sauvegarde alors que rien n'est parti.
  it('signale un echec de creation au lieu de jeter dans le vide', async () => {
    const { service, saveError } = configure();
    const result = await service.createBuild(build);
    expect(result).toBeNull();
    expect(saveError.message()).toContain('Sauvegarde impossible');
  });

  it('signale un echec de suppression', async () => {
    const { service, saveError } = configure();
    await service.deleteBuild('b1');
    expect(saveError.message()).toContain('Sauvegarde impossible');
  });
});
