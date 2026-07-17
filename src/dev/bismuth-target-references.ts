import crystalOneUrl from '../../crystal_references/crystal_small_1.jpg?url';
import crystalTwoUrl from '../../crystal_references/crystal_small_2.jpg?url';
import crystalThreeUrl from '../../crystal_references/crystal_small_3.jpg?url';
import crystalFourUrl from '../../crystal_references/crystal_small_4.jpg?url';
import crystalMultiseedUrl from '../../crystal_references/crystal_multiseed_giant.jpg?url';

export interface BismuthTargetReference {
  readonly label: string;
  readonly source: string;
  readonly alt: string;
  readonly emphasis: string;
}

export const BISMUTH_TARGET_REFERENCES: readonly BismuthTargetReference[] =
  Object.freeze([
    {
      label: 'Reference 1',
      source: crystalOneUrl,
      alt: 'Bulk bismuth hopper with a deep rectilinear recess and many winding ledges.',
      emphasis: 'Dominant hopper, deep recess, winding ledges',
    },
    {
      label: 'Reference 2',
      source: crystalTwoUrl,
      alt: 'Bulk bismuth hopper with an offset rectilinear opening and interrupted terrace bands.',
      emphasis: 'Offset opening, interrupted asymmetric bands',
    },
    {
      label: 'Reference 3',
      source: crystalThreeUrl,
      alt: 'Intergrown bismuth hopper sectors with stepped rectilinear faces.',
      emphasis: 'Regression context: intergrown sectors',
    },
    {
      label: 'Reference 4',
      source: crystalFourUrl,
      alt: 'Large bismuth specimen with branched hopper sectors and irregular nested ledges.',
      emphasis: 'Regression context: connected branching',
    },
    {
      label: 'Reference 5',
      source: crystalMultiseedUrl,
      alt: 'Large bismuth specimen with many visibly differently oriented intergrown hopper sectors.',
      emphasis: 'Later: multi-seed orientation and impingement',
    },
  ]);
