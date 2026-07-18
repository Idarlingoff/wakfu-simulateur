import { Timeline } from './timeline.model';

/** Timeline publique enrichie du pseudo de son auteur (join profiles). */
export interface SharedTimeline extends Timeline {
  authorUsername: string;
}
