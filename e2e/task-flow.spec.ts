import { expect, test, type Page } from '@playwright/test'
import { formatInTimeZone } from 'date-fns-tz'

/**
 * End-to-end Level 3 flow: create a task, complete it from Today, find the
 * record in History, then undo the completion.
 *
 * Required environment:
 *   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY  (for the app)
 *   E2E_EMAIL, E2E_PASSWORD                    (an owner/admin/supervisor account)
 *
 * The spec skips rather than fakes a pass when those are absent.
 */
const email = process.env.E2E_EMAIL
const password = process.env.E2E_PASSWORD
const taskName = `E2E routine ${Date.now()}`

async function signIn(page: Page): Promise<void> {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email as string)
  await page.getByLabel('Password').fill(password as string)
  await page.getByRole('button', { name: /^sign in$/i }).click()
  await page.waitForURL(/\/(today|onboarding)/, { timeout: 30_000 })
}

test.describe('task create, complete, history, undo', () => {
  test.skip(!email || !password, 'Set E2E_EMAIL and E2E_PASSWORD to run this flow.')

  test('records a completion and can undo it', async ({ page }) => {
    await signIn(page)

    if (page.url().includes('/onboarding')) {
      test.skip(true, 'The E2E account has no active space yet.')
    }

    await page.goto('/tasks')
    const newTaskButton = page.getByRole('button', { name: 'New task' })
    if (!(await newTaskButton.isVisible())) {
      test.skip(true, 'The E2E account needs an owner, admin, or supervisor role.')
    }

    await newTaskButton.click()
    await page.getByLabel('Task name').fill(taskName)
    await page.getByLabel('Repeats').selectOption('daily')

    // A task created after its due time starts tomorrow by design. Choose a
    // due time later today so the new task appears in Today for this flow.
    const timezone = await page.locator('[data-space-timezone]').getAttribute('data-space-timezone')
    if (!timezone) {
      test.skip(true, 'The space timezone could not be read from the page.')
      return
    }
    const now = new Date()
    const dueAt = new Date(now.getTime() + 10 * 60 * 1000)
    const dueDay = formatInTimeZone(dueAt, timezone, 'yyyy-MM-dd')
    const today = formatInTimeZone(now, timezone, 'yyyy-MM-dd')
    test.skip(dueDay !== today, 'The next 10 minutes cross midnight in the space timezone.')
    await page.getByLabel('Due time').fill(formatInTimeZone(dueAt, timezone, 'HH:mm'))

    await page.getByRole('button', { name: 'Create task' }).click()
    await expect(page.getByText('Task created')).toBeVisible({ timeout: 15_000 })

    await page.goto('/today')
    const completeButton = page.getByRole('button', { name: `Complete ${taskName}` }).first()
    await expect(completeButton).toBeVisible({ timeout: 15_000 })
    await completeButton.click()
    await expect(page.getByText('Task completed')).toBeVisible({ timeout: 15_000 })

    await page.goto('/history')
    const historyEntry = page
      .locator('section')
      .filter({ has: page.getByRole('heading', { name: taskName }) })
      .first()
    await expect(historyEntry.getByText('Completed', { exact: true }).first()).toBeVisible({
      timeout: 15_000,
    })

    await page.getByRole('button', { name: `Undo completion of ${taskName}` }).click()
    await expect(page.getByText('Completion undone')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('button', { name: `Undo completion of ${taskName}` })).toHaveCount(0)

    await page.goto('/today')
    await expect(
      page.getByRole('button', { name: `Complete ${taskName}` }).first()
    ).toBeVisible({ timeout: 15_000 })

    // Best-effort cleanup so repeated runs stay readable.
    await page.goto('/tasks')
    await page.getByRole('button', { name: `Remove ${taskName}` }).click()
    await page.getByRole('button', { name: 'Remove task' }).click()
    await expect(page.getByText('Task removed')).toBeVisible({ timeout: 15_000 })
  })
})
