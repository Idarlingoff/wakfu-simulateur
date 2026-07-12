import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { UiButtonComponent } from './ui-button.component';

@Component({
  standalone: true,
  imports: [UiButtonComponent],
  template: `<button ui-button [variant]="variant" [disabled]="disabled">Action</button>`,
})
class HostComponent {
  variant: 'primary' | 'ghost' | 'danger' = 'primary';
  disabled = false;
}

describe('UiButtonComponent', () => {
  it('applique la classe de variante et projette le contenu', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const btn = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(btn.classList).toContain('ui-btn--primary');
    expect(btn.textContent?.trim()).toBe('Action');
  });

  it('reflete la variante danger', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.variant = 'danger';
    fixture.detectChanges();
    const btn = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(btn.classList).toContain('ui-btn--danger');
  });

  it('desactive le bouton', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.disabled = true;
    fixture.detectChanges();
    const btn = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });
});
