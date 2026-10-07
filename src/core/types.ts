/** 主要色。OKLab / OKLCH と sRGB の hex を併せ持つ */
export interface DominantColor {
  L: number;
  a: number;
  b: number;
  /** 彩度（OKLCH の C） */
  C: number;
  /** 色相（OKLCH の H、0〜360 度） */
  H: number;
  hex: string;
}

/** パレットの 1 色。占有率の大きい順に並べる */
export interface PaletteColor {
  L: number;
  a: number;
  b: number;
  hex: string;
  /** 占有率 0〜1（パレット全体で合計 1） */
  share: number;
}

/** 構図の指標（32×32 の輝度から求める。値の意味は core/composition.ts） */
export interface Composition {
  /** のっぺりした（輪郭の弱い）画素の割合 0〜1 */
  space: number;
  /** 輪郭の強さの平均（細かさ） */
  detail: number;
  /** 輪郭で重み付けした重心（0〜1、左上が 0）。輪郭がほぼ無ければ 0.5 */
  cx: number;
  cy: number;
  /** 上半分の平均輝度 − 下半分の平均輝度（−1〜1） */
  vertical: number;
  /** 左半分と、右半分を折り返したものとの輝度差の平均（0 に近いほど対称） */
  symmetry: number;
}

/** 明るさ・コントラスト・彩度の質感（32×32 の画素から求める。値の意味は core/tone.ts） */
export interface Tone {
  /** 全体の明るさ（OKLab の L の平均、0〜1） */
  brightness: number;
  /** 明暗の差（L の 5〜95 パーセンタイルの幅、0〜1） */
  contrast: number;
  /** 色の鮮やかさ（OKLCH の C の平均） */
  saturation: number;
}

/** 色抽出の結果（キャッシュ対象） */
export interface Analysis {
  color: DominantColor;
  /** 構図の指標。版 3 以前のキャッシュには無い（再解析される） */
  composition: Composition;
  /** 質感の指標。版 4 以前のキャッシュには無い（再解析される） */
  tone: Tone;
  /** 配色（主要色を選ぶときに出した 5 色の中から、目立つ色）。版 5 以前のキャッシュには無い（再解析される） */
  palette: PaletteColor[];
  /** 約 200px の正方形サムネイル */
  thumb: Blob;
  /** 撮影日時（EXIF の DateTimeOriginal）。読めない画像は undefined */
  shotAt?: number;
  /** 画像の中身の SHA-256（16 進）。お気に入りの識別子に使う。計算できなければ undefined */
  hash?: string;
}

/** 画像 1 枚の参照。プラットフォーム別アダプタが生成する */
export interface ImageFileRef {
  /** フォルダ内の相対パス（表示名にも使う） */
  readonly path: string;
  readonly name: string;
  readonly lastModified: number;
  readonly size: number;
  /** 実体の読み込み（遅延）。Android/iOS では URI / bookmark 経由で実装する */
  getFile(): Promise<Blob>;
}

/** ソート対象の最小構成 */
export interface SortableItem {
  key: string;
  name: string;
  lastModified: number;
  /** 日付順に使う時刻。撮影日時、なければ更新日時 */
  shotAt: number;
  /** 未解析なら undefined */
  color?: Pick<DominantColor, 'L' | 'a' | 'b' | 'C' | 'H'>;
}

export type SortMode = 'color' | 'date';
export type SortDirection = 'asc' | 'desc';
