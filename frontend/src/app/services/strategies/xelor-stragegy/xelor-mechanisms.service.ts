import {inject, Injectable} from '@angular/core';
import {SimulationContext} from '../../calculators/simulation-engine.service';
import {BoardService} from '../../board.service';
import {ResourceRegenerationService} from '../../processors/resource-regeneration.service';

@Injectable({ providedIn: 'root' })

export class XelorMechanismsService {

  private readonly boardService = inject(BoardService);
  private readonly regenerationService = inject(ResourceRegenerationService);

  /**
   * Applique les dégâts du Rouage (fin de tour)
   */
  public applyRouageDamage(context: SimulationContext): void {
    const rouages = this.boardService.getMechanismsByType('cog');

    rouages.forEach(rouage => {
      const charges = context.mechanismCharges?.get(rouage.id) || 0;
      const damage = Math.min(charges, 10) * 20; // 20 dégâts par charge, max 10 charges

      if (damage > 0) {
        console.log(`[XELOR] ⚡ Rouage (${rouage.id}) deals ${damage} Light damage (${charges} charges)`);
        // TODO: Appliquer les dégâts aux ennemis dans la zone (croix, range 2)
        // Pour l'instant, on log simplement
      }
    });
  }

  /**
   * Applique les soins du Sinistro (fin de tour)
   * Utilise le service centralisé ResourceRegenerationService pour la régénération de PA
   */
  public applySinistroHealing(context: SimulationContext): void {
    const sinistros = this.boardService.getMechanismsByType('sinistro');

    sinistros.forEach(sinistro => {
      const charges = context.mechanismCharges?.get(sinistro.id) || 0;

      if (charges > 0) {
        console.log(`[XELOR] 💚 Sinistro (${sinistro.id}) heals adjacent allies (${charges} charges)`);
        // TODO: Calculer et appliquer les soins aux alliés adjacents
        // Soins = 2% PV manquant par charge
      }
    });

    // Déléguer la régénération de PA au service centralisé
    this.regenerationService.applySinistroRegeneration(context);
  }
}
