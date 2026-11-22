import { expect, test } from '@playwright/test'

// Change 04: Kaluppa's Liberica post mixes landscape and portrait photos and a video; the stage must never change height.
const API = 'http://localhost:5100/api'

for (const width of [1440, 390]) {
  test(`post media stage keeps one height for every item at ${width}px`, async ({ page, request }) => {
    await page.setViewportSize({ width, height: 900 })
    const posts = (await (await request.get(`${API}/posts/latest?limit=6`)).json()).data
    const post = posts.find((p) => p.body.startsWith('Fresh Liberica roasts are in!'))
    expect(post.media.length).toBeGreaterThanOrEqual(5)

    await page.goto(`/posts/${post._id}`)
    const stage = page.getByTestId('media-stage')
    const heights = []
    for (let i = 0; i < post.media.length; i++) {
      await expect(page.getByText(`${i + 1} / ${post.media.length}`)).toBeVisible()
      const media = stage.locator('img, video')
      // Wait for the photo to load, so its natural size has had its chance to stretch the stage.
      if (post.media[i].type === 'image') await expect.poll(() => media.evaluate((img) => img.complete && img.naturalWidth > 0)).toBe(true)
      heights.push(Math.round((await stage.boundingBox()).height))
      await page.getByRole('button', { name: 'Next photo or video' }).click()
    }
    expect(new Set(heights), `stage heights: ${heights.join(', ')}`).toEqual(new Set([heights[0]]))
    expect(heights[0]).toBeLessThanOrEqual(560)
  })
}
