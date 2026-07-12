import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { IconComponent } from './icon.component';

@Component({
  standalone: true,
  imports: [IconComponent],
  template: `<ui-icon [name]="name"></ui-icon>`,
})
class HostComponent {
  name = 'home';
}

describe('IconComponent', () => {
  it('rend un svg avec un path pour un nom connu', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const svg = fixture.nativeElement.querySelector('svg');
    expect(svg).toBeTruthy();
    expect(svg.querySelector('path')).toBeTruthy();
    expect(svg.getAttribute('aria-hidden')).toBe('true');
  });

  it('ne rend pas de path pour un nom inconnu', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.name = 'inconnu';
    fixture.detectChanges();
    const svg = fixture.nativeElement.querySelector('svg');
    expect(svg.querySelector('path')).toBeNull();
  });
});
