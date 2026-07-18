import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ImportPageComponent } from './import-page.component';
import { LocalDataImportService } from '../services/storage/local-data-import.service';

const build = (id: string) => ({ id, name: `build ${id}`, classId: 'XEL' } as any);
const timeline = (id: string, buildId: string) => ({ id, name: `tl ${id}`, buildId } as any);

function configure(importResult: Promise<void> = Promise.resolve()) {
  const importService = {
    preview: jasmine.createSpy('preview').and.returnValue(
      Promise.resolve({ builds: [build('b1'), build('b2')], timelines: [timeline('t1', 'b1')] })
    ),
    importSelected: jasmine.createSpy('importSelected').and.returnValue(importResult),
  };
  TestBed.configureTestingModule({
    imports: [ImportPageComponent],
    providers: [provideRouter([]), { provide: LocalDataImportService, useValue: importService }],
  });
  const fixture = TestBed.createComponent(ImportPageComponent);
  fixture.detectChanges();
  return { fixture, component: fixture.componentInstance as any, importService };
}

describe('ImportPageComponent', () => {
  it('coche tout par defaut', async () => {
    const { component } = configure();
    await component.load();
    expect(component.selectedBuildIds().size).toBe(2);
    expect(component.selectedTimelineIds().size).toBe(1);
  });

  it('permet de decocher un element', async () => {
    const { component } = configure();
    await component.load();
    component.toggleBuild('b1');
    expect(component.selectedBuildIds().has('b1')).toBe(false);
    expect(component.selectedBuildIds().has('b2')).toBe(true);
  });

  it('transmet la selection au service', async () => {
    const { component, importService } = configure();
    await component.load();
    component.toggleBuild('b2');
    await component.submit();
    expect(importService.importSelected).toHaveBeenCalledWith({
      buildIds: ['b1'],
      timelineIds: ['t1'],
    });
  });

  it('affiche une erreur si l import echoue, sans rester en chargement', async () => {
    const { component } = configure(Promise.reject(new Error('boom')));
    await component.load();
    await component.submit();
    expect(component.error()).toBe('Import impossible : service indisponible. Tes donnees locales sont intactes.');
    expect(component.loading()).toBe(false);
  });
});
