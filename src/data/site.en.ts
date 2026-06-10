import type { SiteContent } from './types';

export const siteEn: SiteContent = {
  meta: {
    title: 'Japan Guided Walking Tours — Kitakyushu & Shimonoseki',
    description:
      'Local guided walking tours in the Kanmon Strait area: Kitakyushu City and Shimonoseki City, Fukuoka and Yamaguchi, Japan.',
  },
  hero: {
    eyebrow: 'Japan Guided Walking Tours',
    title: 'Kitakyushu City & Shimonoseki City — Fukuoka and Yamaguchi',
    tagline: 'The Cities of the Strait — Where two seas and two shores meet',
  },
  intro: {
    heading: 'The Cities of the Strait',
    paragraphs: [
      'Facing each other across the narrow Kanmon Strait, Kitakyushu and Shimonoseki are neighboring cities where history, culture, and daily life blend together.',
      'Linked by bridge, tunnel, and railway, the two cities have long served as a gateway between Kyushu and Honshu, Japan’s main island, and as a stage for historical events that shaped Japan.',
      'Today, this region offers something rare in Japan: a relaxed, uncrowded urban experience. With the help of a local guide, you will discover historic streets, waterfront scenery, and the everyday local culture of each city — or explore both cities crossing the strait.',
    ],
  },
  cities: {
    heading: 'About the Cities',
    kitakyushu: {
      title: 'Kitakyushu',
      paragraphs: [
        'At the northern tip of Kyushu, facing the strait, Kitakyushu was born in 1963 through the merger of five cities: Moji, Kokura, Wakamatsu, Yahata, and Tobata. The bright light of steel once lit the night sky, and the legacy of the Imperial Steel Works, Yahata — a UNESCO World Heritage site — still tells the story of Japan’s rapid modernization.',
        'Strolling through Mojiko Retro, visitors can enjoy charming early 20th-century architecture and the nostalgic atmosphere of an international port town.',
        'In the city center stands Kokura Castle, the only reconstructed castle keep in Fukuoka Prefecture, proudly overlooking its historic castle town.',
        'Kitakyushu is a city where five unique communities have come together, blending industry, history, sea breezes, and culture into one inspiring destination.',
      ],
    },
    shimonoseki: {
      title: 'Shimonoseki',
      paragraphs: [
        'Located at the western tip of Japan’s main island, Honshu, Shimonoseki is a port city shaped by the strong currents of the narrow strait that separates Honshu and Kyushu.',
        'In the nearby waters, a famous naval battle took place in the late 12th century between two powerful samurai clans, marking the beginning of one era of warrior rule.',
        'Centuries later, in the final days of the samurai age, a group of reform-minded militia was formed here. Their actions helped bring about the great political change that transformed Japan into a modern nation in the late 19th century.',
        'Today, visitors can enjoy dramatic views of the strait and explore a striking seaside shrine with bright red buildings, while discovering layers of Japanese history along the coast.',
        'Shimonoseki is a city where the sea, history, and a spirit of bold change come together.',
      ],
    },
  },
  offer: {
    heading: 'What We Offer',
    paragraphs: [
      'We offer personalized small-group walking tours that explore both famous landmarks and hidden backstreets, meet local people, and take a relaxing café break along the way.',
    ],
    specialHeading: 'What Makes Our Tours Special',
    specialPoints: [
      'All tours are available in either English or Japanese.',
      'When participants of both languages join on the same day, the tour will be conducted as one group led by both an English-speaking guide and a Japanese-speaking guide.',
    ],
  },
  tours: {
    heading: 'Tours',
    intro: 'We are local tour guides based in the Kitakyushu and Shimonoseki area.',
  },
  about: {
    heading: 'About Us',
    paragraphs: [
      'We are local tour guides based in the Kitakyushu and Shimonoseki area.',
      'Each guide brings an inviting personality along with deep knowledge of the Kanmon Strait, its history, and the distinct character of the surrounding communities.',
      'As residents of the region, we take you to spots that you won’t find in guidebooks or online. We are here to help you create fun and memorable travel experiences.',
      'We’ll be wearing or carrying something orange to make it easy to recognize each other when we meet.',
    ],
  },
  access: {
    heading: 'Access',
    groups: [
      {
        heading: 'Access to Kokura',
        routes: [
          { label: 'From Fukuoka', lines: ['Shinkansen to Kokura: about 15 minutes — easily accessible for a day trip.'] },
          { label: 'From Hiroshima', lines: ['Shinkansen (Nozomi / Kodama) to Kokura: about 35–50 minutes.'] },
          { label: 'From Osaka', lines: ['Shinkansen (Nozomi) to Kokura: about 2 hours.'] },
          { label: 'From Tokyo', lines: ['Shinkansen (Nozomi) to Kokura: about 4.5 hours.'] },
        ],
      },
      {
        heading: 'Access to Shimonoseki',
        routes: [{ label: 'From Kokura', lines: ['Local train to Shimonoseki: about 15 minutes.'] }],
      },
      {
        heading: 'Access to Mojiko',
        routes: [{ label: 'From Kokura', lines: ['Local train to Mojiko: about 15 minutes.'] }],
      },
    ],
  },
  contact: {
    heading: 'Contact Us',
    email: 'walkingtours@japanks.com',
  },
};
