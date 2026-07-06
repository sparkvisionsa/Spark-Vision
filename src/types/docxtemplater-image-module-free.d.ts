declare module "docxtemplater-image-module-free" {
  import type { DxtModule } from "docxtemplater";

  type ImageModuleOptions = {
    centered?: boolean;
    getImage: (tagValue: unknown, tagName?: string) => ArrayBuffer | Buffer | Uint8Array;
    getSize: (img: ArrayBuffer | Buffer | Uint8Array, tagValue?: unknown, tagName?: string) => [number, number];
  };

  export default class ImageModule implements DxtModule {
    constructor(options: ImageModuleOptions);
  }
}
