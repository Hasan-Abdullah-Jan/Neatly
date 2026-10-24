import { expect, test, type Page } from '@playwright/test'

/**
 * End-to-end Level 4 flow: report an issue, assign it, start work, resolve it,
 * verify it, and check the timeline. The account must be an owner, admin, or
 * supervisor so the assignment and verification actions are available.
 *
 * Required environment:
 *   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY  (for the app)
 *   E2E_EMAIL, E2E_PASSWORD                    (an owner/admin/supervisor account)
 *
 * The spec skips rather than fakes a pass when those are absent. It leaves the
 * closed issue in place because issue records are intentionally not deletable
 * from the UI.
 */
const email = process.env.E2E_EMAIL
const password = process.env.E2E_PASSWORD
const issueText = `E2E issue ${Date.now()}`

async function signIn(page: Page): Promise<void> {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email as string)
  await page.getByLabel('Password').fill(password as string)
  await page.getByRole('button', { name: /^sign in$/i }).click()
  await page.waitForURL(/\/(today|onboarding)/, { timeout: 30_000 })
}

test.describe('issue report, assign, resolve, verify', () => {
  test.skip(!email || !password, 'Set E2E_EMAIL and E2E_PASSWORD to run this flow.')

  test('keeps a full issue timeline from report to closed', async ({ page }) => {
    await signIn(page)

    if (page.url().includes('/onboarding')) {
      test.skip(true, 'The E2E account has no active space yet.')
    }

    await page.goto('/issues')
    await expect(page.getByRole('heading', { name: 'Issues' })).toBeVisible()
    await page.waitForLoadState('networkidle')

    // Assignment and verification are supervisor actions. Skip honestly when
    // the signed-in account is a regular member.
    if ((await page.getByRole('tab', { name: /supervisor queue/i }).count()) === 0) {
      test.skip(true, 'The E2E account needs an owner, admin, or supervisor role.')
    }

    await page.getByRole('button', { name: 'Report issue' }).first().click()
    const reportDialog = page.getByRole('dialog')
    await reportDialog.getByLabel('What needs attention?').fill(issueText)
    await reportDialog.getByRole('button', { name: 'Report issue' }).click()
    await expect(page.getByText('Issue reported')).toBeVisible({ timeout: 15_000 })

    await page.getByRole('link', { name: new RegExp(issueText) }).first().click()
    await expect(page).toHaveURL(/\/issues\/[0-9a-f-]+$/)
    await expect(page.getByRole('heading', { name: issueText })).toBeVisible()

    await page.getByRole('button', { name: 'Assign', exact: true }).click()
    const assignDialog = page.getByRole('dialog')
    await assignDialog.getByLabel('Assign to').selectOption('person')
    await assignDialog.getByLabel('Person').selectOption({ index: 1 })
    await assignDialog.getByLabel('Assignment note (optional)').fill('E2E assignment note')
    await assignDialog.getByRole('button', { name: 'Save assignment' }).click()
    await expect(page.getByText('Issue assigned')).toBeVisible({ timeout: 15_000 })

    await page.getByRole('button', { name: 'Start work' }).click()
    const startDialog = page.getByRole('dialog')
    await startDialog.getByLabel('Start note (optional)').fill('E2E work started')
    await startDialog.getByRole('button', { name: 'Start work' }).click()
    await expect(page.getByText('Work started')).toBeVisible({ timeout: 15_000 })

    await page.getByRole('button', { name: 'Resolve', exact: true }).click()
    const resolveDialog = page.getByRole('dialog')
    await resolveDialog.getByLabel('Resolution note').fill('E2E resolved the issue')
    await resolveDialog.getByRole('button', { name: 'Mark resolved' }).click()
    await expect(page.getByText('Issue resolved')).toBeVisible({ timeout: 15_000 })

    await page.getByRole('button', { name: /Verify & close/ }).click()
    const verifyDialog = page.getByRole('dialog')
    await verifyDialog.getByLabel('Verification note (optional)').fill('E2E verification note')
    await verifyDialog.getByRole('button', { name: 'Verify and close' }).click()
    await expect(page.getByText('Issue verified and closed')).toBeVisible({ timeout: 15_000 })

    await expect(page.getByText('Verified / Closed', { exact: true }).first()).toBeVisible()
    await expect(page.getByText(/reported the issue/i).first()).toBeVisible()
    await expect(page.getByText(/assigned to/i).first()).toBeVisible()
    await expect(page.getByText(/started work/i).first()).toBeVisible()
    await expect(page.getByText(/marked the issue resolved/i).first()).toBeVisible()
    await expect(page.getByText(/verified and closed the issue/i).first()).toBeVisible()
    await expect(page.getByText('E2E verification note')).toBeVisible()
  })
})
