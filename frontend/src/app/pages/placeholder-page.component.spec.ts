import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PlaceholderPageComponent } from './placeholder-page.component';

@Component({
  standalone: true,
  imports: [PlaceholderPageComponent],
  template: `<app-placeholder-page [title]="'Builds'" [message]="'msg'"></app-placeholder-page>`,
})
class HostComponent {}

describe('PlaceholderPageComponent', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [HostComponent], providers: [provideRouter([])] });
  });

  it('affiche le titre et le message fournis', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h1')?.textContent).toContain('Builds');
    expect(el.textContent).toContain('msg');
  });
});
