import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

test.describe('standalone demo', () => {
  test('shows helpful setup guidance rather than a blank page when Supabase is not configured', async ({ page }) => {
    await page.goto('/login')
    if (await page.getByRole('heading', { name: 'Welcome back' }).isVisible()) {
      test.skip(true, 'The setup fallback is only shown when public Supabase configuration is missing.')
    }
    await expect(page.getByRole('heading', { name: 'One quick setup step' })).toBeVisible()
    await expect(page.getByText('VITE_SUPABASE_URL=...')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Explore the demo' })).toHaveAttribute('href', '/demo')
    const accessibility = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()
    expect(accessibility.violations).toEqual([])
    for (const width of [360, 390, 768]) {
      await page.setViewportSize({ width, height: 900 })
      const dimensions = await page.locator('html').evaluate((element) => ({
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
      }))
      expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth)
    }
  })

  test('runs the guided apartment and organization walkthrough', async ({ page }) => {
    await page.goto('/demo')
    await page.getByRole('button', { name: 'Start demo' }).click()
    await page.getByRole('button', { name: 'Create apartment' }).click()
    await expect(page.getByText('Kitchen reset', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Complete kitchen reset' }).click()
    await expect(page.getByText('Today · Kitchen reset submitted')).toBeVisible()
    await page.getByRole('button', { name: 'Add cleaning solution · mark low' }).click()
    await expect(page.getByText('Low stock').first()).toBeVisible()
    await page.getByRole('button', { name: 'Switch to organization' }).click()
    await page.getByRole('button', { name: 'Assign restroom reset to cleaner' }).click()
    await page.getByRole('button', { name: 'Simulate scanning Kitchen QR' }).click()
    await page.getByRole('button', { name: 'Complete checklist' }).click()
    await page.getByLabel('Switch demo role').selectOption('supervisor')
    await page.getByRole('button', { name: 'Verify submission' }).click()
    await page.getByLabel('Switch demo role').selectOption('cleaner')
    await page.getByRole('button', { name: 'Report dispenser issue' }).click()
    await page.getByLabel('Switch demo role').selectOption('supervisor')
    await page.getByRole('button', { name: 'Assign issue to supervisor' }).click()
    await page.getByRole('button', { name: 'Resolve issue' }).click()
    await page.getByRole('button', { name: 'Open dashboard' }).click()
    await page.getByRole('button', { name: 'Accept' }).click()

    await expect(page.getByText('Walkthrough complete')).toBeVisible()
    await expect(page.getByText('Verification: verified by Jordan Supervisor')).toBeVisible()
    await expect(page.getByText('Status: accepted')).toBeVisible()

    await page.getByRole('button', { name: 'Reset demo' }).first().click()
    await expect(page.getByRole('button', { name: 'Start demo' })).toBeVisible()
  })

  test('supports QR deep links, rework, and accessible reset', async ({ page }) => {
    await page.goto('/demo')
    await page.getByRole('button', { name: 'Organization', exact: true }).click()
    await page.getByRole('link', { name: 'Open demo QR for Kitchen' }).click()
    await expect(page.getByText('QR opened Kitchen.')).toBeVisible()

    await page.getByRole('button', { name: 'Start demo' }).click()
    await page.getByRole('button', { name: 'Create apartment' }).click()
    await page.getByRole('button', { name: 'Complete kitchen reset' }).click()
    await page.getByRole('button', { name: 'Add cleaning solution · mark low' }).click()
    await page.getByRole('button', { name: 'Switch to organization' }).click()
    await page.getByRole('button', { name: 'Assign restroom reset to cleaner' }).click()
    await page.getByRole('button', { name: 'Simulate scanning Kitchen QR' }).click()
    await page.getByRole('button', { name: 'Complete checklist' }).click()
    await page.getByLabel('Switch demo role').selectOption('supervisor')
    await page.getByRole('button', { name: 'Request rework' }).click()
    await expect(page.getByText('Restroom reset (rework)')).toBeVisible()
    await expect(page.getByText('Verification: rework requested')).toBeVisible()

    await page.getByRole('button', { name: 'Reset demo' }).first().click()
    const accessibility = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()
    expect(accessibility.violations).toEqual([])
  })

  test('keeps system dark mode readable and accessible', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.goto('/demo')

    const notice = await page.locator('main > div').first().evaluate((element) => {
      const view = element.ownerDocument.defaultView
      if (!view) throw new Error('Page window is unavailable.')
      const style = view.getComputedStyle(element)
      return { color: style.color, background: style.backgroundColor }
    })
    expect(notice.color).not.toBe('rgb(250, 250, 250)')
    expect(notice.background).not.toContain('255, 255, 255')

    const accessibility = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()
    expect(accessibility.violations).toEqual([])
  })

  for (const width of [360, 390, 768]) {
    test(`fits a ${width}px viewport without horizontal overflow`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await page.goto('/demo')
      await expect(page.getByRole('heading', { name: 'Apartment', exact: true }).first()).toBeVisible()
      const dimensions = await page.locator('html').evaluate((element) => ({
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
      }))
      expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth)
    })
  }
})
