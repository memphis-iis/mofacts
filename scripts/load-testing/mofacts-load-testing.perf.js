import { step, TestSettings, By, Until, Key } from '@flood/element'

export const settings = {
	// userAgent: 'flood-chrome-test',
	// loopCount: 1,
	// Automatically wait for elements before trying to interact with them
	waitUntil: 'visible',
	stepDelay: 2.5
}

export default () => {
	step('Startup', async browser => {
		await browser.visit('https://staging.optimallearning.org/signinSouthwest?showTestLogins=true')
		await browser.wait(Until.elementIsVisible(By.visibleText('pavlik@southwest.tn.edu')))
		await browser.click(By.visibleText('pavlik@southwest.tn.edu'))
		await browser.click(By.visibleText('BIOL 2010'))

		let randomUserName =
			Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
		await browser.type(By.css('#username'), randomUserName)

		await browser.click(By.visibleText('Sign In'))
		await browser.click(By.visibleText('Simple'))
		await browser.click(By.visibleText('Chapter 9 testerdoodle'))
		await browser.click(By.visibleText('Chapter 9 All Items'))
		await browser.click(By.css('#userAnswer'))
		await browser.type(By.css('#userAnswer'), 'yes')
		await browser.focus(By.css('#userAnswer'))

		let page = browser.page
		await page.keyboard.press('Enter')
		await browser.click(By.visibleText('Continue'))
	})

	step.repeat(1000, 'Trials', async browser => {
		await browser.wait(Until.elementIsVisible(By.css('#userAnswer')));
		await browser.wait(Until.elementIsEnabled(By.css('#userAnswer')));
		let correctAnswer = await browser.evaluate(() => Session.get('currentAnswer'))
		let rand = Math.floor(Math.random() * 11)
		let answer = rand >= 5 ? correctAnswer : 'an incorrect answer'
		await browser.type(By.css('#userAnswer'), answer)

		let page = browser.page
		await page.keyboard.press('Enter')
	})
}
