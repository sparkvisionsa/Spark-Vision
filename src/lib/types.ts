export interface PlaceholderImage {
  id: string;
  description: string;
  imageUrl: string;
  imageHint: string;
  videoUrl?: string; // Optional video URL
}

export interface PlaceholderImagesData {
  placeholderImages: PlaceholderImage[];
}
