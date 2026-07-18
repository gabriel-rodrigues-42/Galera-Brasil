interface ImagePost {
  type: 'image';
  id: string;
  caption: string;
  accentColor: string;
}

interface TextPost {
  type: 'text';
  id: string;
  title: string;
  body: string;
}

interface LinkPost {
  type: 'link';
  id: string;
  label: string;
  url: string;
  description: string;
}

export type HubPost = ImagePost | TextPost | LinkPost;

export interface HubDescription {
  owner: string;
  bio: string;
  tag: string;
  posts: HubPost[];
}
