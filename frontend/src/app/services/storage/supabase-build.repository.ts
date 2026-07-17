import { inject, Injectable } from '@angular/core';
import { from, Observable } from 'rxjs';
import { Build } from '../../models/build.model';
import { AuthService } from '../auth.service';
import { SupabaseClientService } from '../supabase-client.service';
import { BuildRepository } from './build-repository';
import { LocalMirror } from './local-mirror.service';

/**
 * Stockage cloud des builds.
 *
 * Lecture : Postgres, recopiee dans le miroir. Si Postgres est injoignable, le miroir
 * repond — le simulateur continue de tourner (invariant du lot 1).
 * Ecriture : cloud uniquement, AUCUN repli. Une ecriture qui echoue DOIT jeter : un
 * echec silencieux laisserait croire a une sauvegarde.
 */
@Injectable({ providedIn: 'root' })
export class SupabaseBuildRepository implements BuildRepository {
  private readonly supabase = inject(SupabaseClientService);
  private readonly auth = inject(AuthService);
  private readonly mirror = inject(LocalMirror);

  private table() {
    return this.supabase.client.from('builds');
  }

  private requireUserId(): string {
    const id = this.auth.userId();
    if (!id) {
      throw new Error('Aucun utilisateur connecte');
    }
    return id;
  }

  private toRow(build: Build, ownerId: string) {
    return { id: build.id, owner_id: ownerId, name: build.name, class_id: build.classId, data: build };
  }

  private fromRow(row: any): Build {
    return { ...(row.data as Build), id: row.id, name: row.name };
  }

  getAll(): Observable<Build[]> {
    return from(this.readAll());
  }

  private async readAll(): Promise<Build[]> {
    const userId = this.auth.userId();
    if (!userId) {
      return [];
    }
    try {
      const { data, error } = await this.table().select('id, name, class_id, data').eq('owner_id', userId);
      if (error) {
        throw new Error(error.message);
      }
      const builds = (data ?? []).map((row: any) => this.fromRow(row));
      this.mirror.write(userId, 'builds', builds);
      return builds;
    } catch {
      // Postgres injoignable : le miroir prend le relais.
      return this.mirror.read<Build>(userId, 'builds') ?? [];
    }
  }

  getById(id: string): Observable<Build> {
    return from(this.readOne(id));
  }

  private async readOne(id: string): Promise<Build> {
    const found = (await this.readAll()).find(b => b.id === id);
    if (!found) {
      throw new Error(`Build ${id} not found`);
    }
    return found;
  }

  create(build: Build): Observable<Build> {
    return from((async () => {
      const userId = this.requireUserId();
      const { error } = await this.table().insert(this.toRow(build, userId));
      if (error) {
        throw new Error(error.message);
      }
      return build;
    })());
  }

  update(id: string, build: Build): Observable<Build> {
    return from((async () => {
      const userId = this.requireUserId();
      const { error } = await this.table().update(this.toRow(build, userId)).eq('id', id);
      if (error) {
        throw new Error(error.message);
      }
      return build;
    })());
  }

  delete(id: string): Observable<void> {
    return from((async () => {
      this.requireUserId();
      const { error } = await this.table().delete().eq('id', id);
      if (error) {
        throw new Error(error.message);
      }
      return undefined;
    })());
  }
}
