export interface GenreDefinition {
  genre: string;
  subGenres: string[];
}

export const MAJOR_GENRES: GenreDefinition[] = [
  {
    genre: 'hip hop / rap',
    subGenres: [
      'trap',
      'boom bap',
      'drill',
      'cloud rap',
      'conscious',
      'lo-fi',
      'east coast',
      'west coast',
      'uk drill',
      'southern',
      'grime',
      'melodic rap',
      'chopped and screwed',
      'underground hip hop',
      'plugg',
      'emo rap',
      'jazz rap',
    ],
  },
  {
    genre: 'rock',
    subGenres: [
      'indie rock',
      'alternative rock',
      'punk rock',
      'post-rock',
      'grunge',
      'heavy metal',
      'hard rock',
      'math rock',
      'classic rock',
      'psychedelic rock',
      'emo',
      'shoegaze',
      'garage rock',
      'post-punk',
      'art rock',
    ],
  },
  {
    genre: 'electronic / dance',
    subGenres: [
      'house',
      'deep house',
      'tech house',
      'techno',
      'minimal techno',
      'drum & bass',
      'jungle',
      'dubstep',
      'ambient',
      'idm',
      'synthwave',
      'uk garage',
      'trance',
      'electro',
      'downtempo',
      'breakbeat',
      'trip hop',
    ],
  },
  {
    genre: 'pop',
    subGenres: [
      'synthpop',
      'indie pop',
      'bedroom pop',
      'hyperpop',
      'art pop',
      'dream pop',
      'dance pop',
      'chamber pop',
      'k-pop',
      'electropop',
      'bubblegum pop',
    ],
  },
  {
    genre: 'r&b / soul',
    subGenres: [
      'contemporary r&b',
      'neo-soul',
      'soul',
      'funk',
      'motown',
      'trapsoul',
      'quiet storm',
      'alternative r&b',
      'doo-wop',
      'gospel',
    ],
  },
  {
    genre: 'jazz',
    subGenres: [
      'bebop',
      'post-bop',
      'fusion',
      'cool jazz',
      'hard bop',
      'free jazz',
      'nu-jazz',
      'contemporary jazz',
      'latin jazz',
      'smooth jazz',
      'ambient jazz',
      'modal jazz',
    ],
  },
  {
    genre: 'folk / acoustic',
    subGenres: [
      'contemporary folk',
      'indie folk',
      'traditional folk',
      'singer-songwriter',
      'americana',
      'bluegrass',
      'anti-folk',
      'celtic folk',
    ],
  },
  {
    genre: 'classical',
    subGenres: [
      'baroque',
      'classical era',
      'romantic era',
      'modern classical',
      'contemporary classical',
      'minimalism',
      'orchestral',
      'chamber music',
      'choral',
      'opera',
    ],
  },
  {
    genre: 'metal',
    subGenres: [
      'heavy metal',
      'death metal',
      'black metal',
      'thrash metal',
      'doom metal',
      'metalcore',
      'post-metal',
      'sludge metal',
      'progressive metal',
      'nu metal',
    ],
  },
  {
    genre: 'latin',
    subGenres: [
      'reggaeton',
      'latin trap',
      'salsa',
      'bachata',
      'cumbia',
      'bossa nova',
      'latin jazz',
      'afro-cuban',
      'mariachi',
    ],
  },
  {
    genre: 'reggae / dancehall',
    subGenres: [
      'roots reggae',
      'dancehall',
      'dub',
      'lovers rock',
      'ska',
      'rocksteady',
      'ragga',
    ],
  },
  {
    genre: 'country',
    subGenres: [
      'contemporary country',
      'alternative country',
      'outlaw country',
      'bluegrass',
      'country folk',
      'honky tonk',
    ],
  },
  {
    genre: 'blues',
    subGenres: [
      'delta blues',
      'chicago blues',
      'electric blues',
      'blues rock',
      'acoustic blues',
      'jump blues',
    ],
  },
  {
    genre: 'world / traditional',
    subGenres: [
      'afrobeat',
      'highlife',
      'amapiano',
      'celtic',
      'flamenco',
      'indian classical',
      'qawwali',
      'middle eastern',
    ],
  },
  {
    genre: 'ambient / experimental',
    subGenres: [
      'drone',
      'dark ambient',
      'noise',
      'musique concrète',
      'soundscape',
      'glitch',
      'field recording',
      'industrial',
    ],
  },
];

export function getSubGenresForGenre(genreName: string, customGenres?: { [key: string]: string[] }): string[] {
  const normalized = genreName.trim().toLowerCase();
  const builtIn = MAJOR_GENRES.find((g) => g.genre.toLowerCase() === normalized);
  if (builtIn) {
    const customList = customGenres?.[normalized] || [];
    return Array.from(new Set([...builtIn.subGenres, ...customList]));
  }
  if (customGenres?.[normalized]) {
    return customGenres[normalized];
  }
  return [];
}
