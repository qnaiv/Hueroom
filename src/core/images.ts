/** 読み込み対象の拡張子 */
const IMAGE_EXT = /\.(jpe?g|png|webp|gif)$/i;

export const isImageName = (name: string): boolean => IMAGE_EXT.test(name);

/** 隠しファイル・隠しフォルダ（. で始まる）は対象外 */
export const isHiddenName = (name: string): boolean => name.startsWith('.');
