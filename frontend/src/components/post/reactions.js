import { IconHeart, IconStar, IconThumbsUp } from '@/components/ui/icons'

/** Phase 1's like / love / celebrate: label, icon and the round tile colours (PostDetail.dc.html, Hub.dc.html). */
export const REACTIONS = [
  { key: 'like', label: 'Like', icon: IconThumbsUp, tile: 'bg-roast text-white' },
  { key: 'love', label: 'Love', icon: IconHeart, tile: 'bg-danger-strong text-white' },
  { key: 'celebrate', label: 'Celebrate', icon: IconStar, tile: 'bg-caramel text-espresso' },
]
