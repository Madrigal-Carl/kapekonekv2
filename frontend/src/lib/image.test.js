import { describe, expect, it } from 'vitest'
import { imageSrcSet, imageUrl, squareUrl } from './image'

describe('imageUrl', () => {
  it('adds format, quality and a 2× width limit to Cloudinary uploads', () => {
    expect(imageUrl('https://res.cloudinary.com/kk/image/upload/v1/kapekonek/seed/barako.jpg', 320)).toBe(
      'https://res.cloudinary.com/kk/image/upload/f_auto,q_auto,c_limit,w_640/v1/kapekonek/seed/barako.jpg',
    )
  })

  it('leaves other URLs, videos and empty values alone', () => {
    expect(imageUrl('https://images.pexels.com/photo.jpg', 320)).toBe('https://images.pexels.com/photo.jpg')
    expect(imageUrl('https://res.cloudinary.com/kk/video/upload/v1/clip.mp4', 320)).toBe('https://res.cloudinary.com/kk/video/upload/v1/clip.mp4')
    expect(imageUrl(null, 320)).toBeUndefined()
  })
})

describe('imageSrcSet', () => {
  it('lists one resized URL per width, and nothing for other URLs', () => {
    expect(imageSrcSet('https://res.cloudinary.com/kk/image/upload/v1/h.jpg', [640, 1280])).toBe(
      'https://res.cloudinary.com/kk/image/upload/f_auto,q_auto,c_limit,w_640/v1/h.jpg 640w, https://res.cloudinary.com/kk/image/upload/f_auto,q_auto,c_limit,w_1280/v1/h.jpg 1280w',
    )
    expect(imageSrcSet('https://images.pexels.com/p.jpg', [640])).toBeUndefined()
  })
})

describe('squareUrl', () => {
  it('crops Cloudinary photos to a 2× square around the subject, and leaves other URLs alone', () => {
    expect(squareUrl('https://res.cloudinary.com/kk/image/upload/v1/p.jpg', 160)).toBe(
      'https://res.cloudinary.com/kk/image/upload/f_auto,q_auto,c_fill,g_auto,w_320,h_320/v1/p.jpg',
    )
    expect(squareUrl('https://images.pexels.com/p.jpg', 160)).toBe('https://images.pexels.com/p.jpg')
  })
})
