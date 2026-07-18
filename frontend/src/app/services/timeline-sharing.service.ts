import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Timeline } from '../models/timeline.model';
import { SharedTimeline } from '../models/shared-timeline.model';
import { WakfuApiService } from './wakfu-api.service';
import { SaveErrorService } from './save-error.service';

export type Visibility = 'private' | 'unlisted' | 'public';

/** Actions transverses de partage : visibilite, lien, duplication. */
@Injectable({ providedIn: 'root' })
export class TimelineSharingService {
  private readonly api = inject(WakfuApiService);
  private readonly saveError = inject(SaveErrorService);

  async setVisibility(timeline: Timeline, visibility: Visibility): Promise<boolean> {
    try {
      await firstValueFrom(this.api.updateTimeline(timeline.id, { ...timeline, visibility }));
      return true;
    } catch {
      this.saveError.reportFailure();
      return false;
    }
  }

  /** URL absolue vers la vue partagee. Porte le jeton, jamais l'id. */
  shareLink(timeline: Timeline): string {
    const base = window.location.origin + this.baseHref();
    return `${base}t/${timeline.shareToken}`;
  }

  /** Copie une timeline partagee dans le compte du lecteur : privee, nouvel id, sans build. */
  async duplicate(shared: SharedTimeline): Promise<Timeline | null> {
    const copy: Timeline = {
      ...shared,
      id: crypto.randomUUID(),
      name: `${shared.name} (copie)`,
      visibility: 'private',
      // Partage "structure seule" : le lecteur rejoue avec SON build, pas celui de l'auteur.
      buildId: '',
      shareToken: undefined,
    };
    delete (copy as Partial<SharedTimeline>).authorUsername;
    try {
      return await firstValueFrom(this.api.createTimeline(copy));
    } catch {
      this.saveError.reportFailure();
      return null;
    }
  }

  private baseHref(): string {
    const base = document.querySelector('base')?.getAttribute('href') ?? '/';
    return base.endsWith('/') ? base : `${base}/`;
  }
}
