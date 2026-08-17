import { describe, expect, it } from 'vitest'
import { publishBlogIndexItemList } from './publish-blog-index-list'

describe('publishBlogIndexItemList', () => {
  it('uses collection-global positions and the total count', () => {
    const published = publishBlogIndexItemList({
      posts: [
        { slug: 'eagle-crest-affordable-resort-redmond', title: 'Eagle Crest' },
        { slug: 'vacation-rental-rules-bend-deschutes', title: 'Vacation Rental Rules' },
      ],
      offset: 12,
      total: 55,
      siteUrl: 'https://ryan-realty.com/',
    })
    expect(published.numberOfItems).toBe(55)
    expect(published.itemListElement.map((item) => item.position)).toEqual([13, 14])
    expect(published.itemListElement[1]).toEqual({
      '@type': 'ListItem',
      position: 14,
      url: 'https://ryan-realty.com/blog/vacation-rental-rules-bend-deschutes',
      name: 'Vacation Rental Rules',
    })
  })

  it('drops a duplicate slug so one post cannot occupy two positions', () => {
    const published = publishBlogIndexItemList({
      posts: [
        { slug: 'vacation-rental-rules-bend-deschutes', title: 'Vacation Rental Rules' },
        { slug: 'vacation-rental-rules-bend-deschutes', title: 'Vacation Rental Rules' },
        { slug: 'guide-to-new-construction', title: 'New Construction' },
      ],
      offset: 24,
      total: 55,
      siteUrl: 'https://ryan-realty.com',
    })
    expect(published.itemListElement.map((item) => item.url)).toEqual([
      'https://ryan-realty.com/blog/vacation-rental-rules-bend-deschutes',
      'https://ryan-realty.com/blog/guide-to-new-construction',
    ])
    expect(published.itemListElement.map((item) => item.position)).toEqual([25, 26])
  })
})
