import {inject, Injectable} from '@angular/core';
import {SimulationContext} from '../../calculators/simulation-engine.service';
import {ResourceRegenerationService} from '../../processors/resource-regeneration.service';
import {XelorCastValidatorService} from './xelor-cast-validator.service';

@Injectable({ providedIn: 'root' })
export class XelorPassivesService {

  private static readonly MAITRE_DU_CADRAN_ID = 'XEL_MAITRE_CADRAN';
  private static readonly COURS_DU_TEMPS = 'XEL_COURS_TEMPS';
  private static readonly CONNAISSANCE_PASSE = 'XEL_CONNAISSANCE_PASSE';
  private readonly regenerationService = inject(ResourceRegenerationService);
  private readonly xelorCastValidator = inject(XelorCastValidatorService);

  /**
   * Vérifie si le passif "Maître du Cadran" est actif
   * Ce passif permet de résoudre les effets différés lors d'un tour de cadran
   */
  public hasMaitreDuCadranPassive(context: SimulationContext): boolean {
    const passiveIds = context.activePassiveIds || [];
    console.log(`[XELOR MAITRE_CADRAN] 🔍 Checking for Maître du Cadran passive...`);
    console.log(`[XELOR MAITRE_CADRAN]    Active passive IDs in context: [${passiveIds.join(', ')}]`);
    console.log(`[XELOR MAITRE_CADRAN]    Looking for any of: ${XelorPassivesService.MAITRE_DU_CADRAN_ID.toLowerCase()}`);

    const found = passiveIds.some(
      activeId => activeId.toLowerCase() === XelorPassivesService.MAITRE_DU_CADRAN_ID.toLowerCase()
    );

    console.log(`[XELOR MAITRE_CADRAN]    Result: ${found ? '✅ FOUND' : '❌ NOT FOUND'}`);
    return found;
  }

  /**
   * Vérifie si le passif "Cours du temps" est actif
   * Ce passif :
   * - À chaque transposition causée par le Xélor :
   *   - Régénère 1 PA si Distorsion est actif
   *   - Autrement, régénère 1 PW
   */
  public hasCoursDuTempsPassive(context: SimulationContext): boolean {
    const passiveIds = context.activePassiveIds || [];
    const found = passiveIds.some(
      activeId => activeId.toLowerCase() === XelorPassivesService.COURS_DU_TEMPS.toLowerCase()
    );

    console.log(`[XELOR COURS_DU_TEMPS]    Result: ${found ? '✅ FOUND' : '❌ NOT FOUND'}`);
    return found;
  }

  /**
   * Traite l'effet du passif "Cours du temps" lors d'une transposition
   * - Si Distorsion est actif : +1 PA
   * - Sinon : +1 PW
   *
   * @param context Le contexte de simulation
   * @param transpositionType Type de transposition effectuée (pour le logging)
   */
  public applyCoursduTempsOnTransposition(context: SimulationContext, transpositionType: string = 'standard'): void {
    if (!this.hasCoursDuTempsPassive(context)) {
      return;
    }

    const isDistorsionActive = this.xelorCastValidator.isDistorsionActive(context);

    if (isDistorsionActive) {
      // Distorsion active : +1 PA
      this.regenerationService.regeneratePA(
        context,
        1,
        'COURS_DU_TEMPS',
        'Cours du temps: +1 PA (Distorsion actif)',
        { trigger: 'ON_TRANSPOSITION', transpositionType, distorsionActive: true }
      );
      console.log(`[XELOR COURS_DU_TEMPS] ⚡ +1 PA (Distorsion actif) - Transposition: ${transpositionType}`);
    } else {
      // Distorsion inactif : +1 PW
      this.regenerationService.regeneratePW(
        context,
        1,
        'COURS_DU_TEMPS',
        'Cours du temps: +1 PW (Distorsion inactif)',
        { trigger: 'ON_TRANSPOSITION', transpositionType, distorsionActive: false }
      );
      console.log(`[XELOR COURS_DU_TEMPS] 💧 +1 PW (Distorsion inactif) - Transposition: ${transpositionType}`);
    }
  }

  /**
   * Vérifie si le passif "Connaissance du passé" est actif
   * Ce passif :
   * - Régénère 2 PA et 2 PW à chaque tour de cadran
   * - Le Cadran coûte +2 PW supplémentaires
   */
  public hasConnaissancePassePassive(context: SimulationContext): boolean {
    const passiveIds = context.activePassiveIds || [];
    const found = passiveIds.some(
      activeId => activeId.toLowerCase() === XelorPassivesService.CONNAISSANCE_PASSE.toLowerCase()
    );

    console.log(`[XELOR CCONNAISSANCE_PASSE]    Result: ${found ? '✅ FOUND' : '❌ NOT FOUND'}`);
    return found;
  }

  /**
   * Applique la régénération du passif "Connaissance du passé"
   * À chaque tour de cadran : +2 PA et +2 PW
   */
  public applyConnaissancePasseRegeneration(context: SimulationContext): void {
    console.log('[XELOR CONNAISSANCE_PASSE] ⚡ Triggering Connaissance du passé regeneration on ON_HOUR_WRAPPED');

    // Régénérer 2 PA
    this.regenerationService.regeneratePA(
      context,
      2,
      'CONNAISSANCE_PASSE',
      'Connaissance du passé: +2 PA (tour de cadran)',
      { trigger: 'ON_HOUR_WRAPPED' }
    );

    // Régénérer 2 PW
    this.regenerationService.regeneratePW(
      context,
      2,
      'CONNAISSANCE_PASSE',
      'Connaissance du passé: +2 PW (tour de cadran)',
      { trigger: 'ON_HOUR_WRAPPED' }
    );

    console.log('[XELOR CONNAISSANCE_PASSE] ✅ Regeneration complete: +2 PA, +2 PW');
  }
}
