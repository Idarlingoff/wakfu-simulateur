import { Observable } from 'rxjs';
import { Build } from '../../models/build.model';

/** Contrat de stockage des builds. Implemente en local (invite) et Supabase (connecte). */
export interface BuildRepository {
  getAll(): Observable<Build[]>;
  getById(id: string): Observable<Build>;
  create(build: Build): Observable<Build>;
  update(id: string, build: Build): Observable<Build>;
  delete(id: string): Observable<void>;
}
