import type { HomeImages } from './types';

/**
 * Seed for the home page photos — what the page showed before the Home Page
 * admin tab existed. Like tours.en.ts, this only matters until the client first
 * saves the home page; after that the stored copy wins.
 */
export const homeImagesSeed: HomeImages = {
  banners: [
    {
      src: '/images/hero.jpg',
      alt: {
        en: 'Aerial view of the Kanmon Strait connecting Kitakyushu and Shimonoseki',
        ja: '関門海峡の空撮（北九州市・下関市）',
      },
    },
    {
      src: '/images/site/kanmon-bridge-sunset.jpg',
      alt: {
        en: 'Sunset view of the Kanmon Bridge connecting Kitakyushu and Shimonoseki',
        ja: '夕暮れの関門橋、北九州市と下関市を結ぶ',
      },
    },
  ],
  regionMap: {
    src: '/images/site/kanmon-region-map.jpg',
    alt: {
      en: 'Map showing Kitakyushu City and Shimonoseki City facing each other across the Kanmon Strait',
      ja: '関門海峡を挟んで向かい合う北九州市と下関市を示す地図',
    },
  },
  kitakyushuGallery: [
    { src: '/images/site/kitakyushu-bridge.jpg', alt: { en: 'Wakato Bridge over the Kanmon Strait, Kitakyushu', ja: '若戸大橋と関門海峡(北九州市)' } },
    { src: '/images/site/kitakyushu-castle-area.jpg', alt: { en: 'Kokura Castle and Riverwalk Kitakyushu', ja: '小倉城とリバーウォーク北九州' } },
    { src: '/images/site/mojiko-station.jpg', alt: { en: 'Mojiko Retro Station, Kitakyushu', ja: '門司港レトロ駅舎(北九州市)' } },
  ],
  shimonosekiGallery: [
    { src: '/images/site/shimonoseki-strait.jpg', alt: { en: 'Aerial view of the Kanmon Strait and Kanmon Bridge, Shimonoseki', ja: '関門海峡と関門橋(下関市)' } },
    { src: '/images/site/shimonoseki-tower.jpg', alt: { en: 'Akama Jingu Shrine, Shimonoseki', ja: '赤間神宮(下関市)' } },
    { src: '/images/site/shimonoseki-fugu.jpg', alt: { en: 'Fugu (blowfish) statue, Shimonoseki', ja: 'ふくの像(下関市)' } },
  ],
  offerGallery: [
    { src: '/images/site/retro-street.jpg', alt: { en: 'A quiet retro backstreet explored on a walking tour', ja: 'ツアーで巡る趣のある裏通り' } },
    { src: '/images/site/cafe-break.jpg', alt: { en: 'A relaxing cafe break during a tour', ja: 'ツアー途中のカフェでのひと休み' } },
  ],
  aboutGallery: [
    { src: '/images/site/guide-takahashi.jpg', alt: { en: 'Takahashi, a Kanmon Tours guide', ja: 'Kanmon Tours ガイド 高橋' } },
    { src: '/images/site/guide-hattori.jpg', alt: { en: 'Hattori, a Kanmon Tours guide', ja: 'Kanmon Tours ガイド 服部' } },
    { src: '/images/site/guide-ikemoto.jpg', alt: { en: 'Ikemoto, a Kanmon Tours guide', ja: 'Kanmon Tours ガイド 池本' } },
    { src: '/images/site/team-group.jpg', alt: { en: 'The Kanmon Tours guide team', ja: 'Kanmon Tours のガイドチーム' } },
  ],
  accessMap: {
    src: '/images/site/shinkansen-map.jpg',
    alt: { en: 'Sanyo Shinkansen route map', ja: '山陽新幹線 路線図' },
  },
};
