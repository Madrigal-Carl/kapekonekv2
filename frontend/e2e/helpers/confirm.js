/** "Save these changes?" (ConfirmChangesModal): every edit of an existing record asks before it saves. */
export const confirmSave = (page) => page.getByRole('dialog', { name: 'Save these changes?' }).getByRole('button', { name: 'Save changes' }).click()
