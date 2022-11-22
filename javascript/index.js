const sqlite3 = require('sqlite3')
const open = require('sqlite').open
const fs = require('fs')

const filename = 'contacts.sqlite3'
const numContacts = Number.parseInt(process.argv.slice(2)[0]) // Get the first argument from CLI ; assume the user gives a correct value
const blockSize = Number.parseInt(process.argv.slice(2)[1]) // Get the second argument from CLI ; assume the user gives a correct value

const shouldMigrate = !fs.existsSync(filename)

/**
 * Generate `numContacts` contacts,
 * one at a time
 *
 */
function * generateContacts (numContacts) {
  let i = 1
  while (i <= numContacts) {
    yield { name: `name-${i}`, email: `email-${i}@domain.tld` }
    i++
  }
}

const migrate = async (db) => {
  console.log('Migrating db ...')
  await db.exec(`
        CREATE TABLE contacts(
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT NOT NULL
         )
     `)
  console.log('Done migrating db')
}

const insertContacts = async (db) => {
  console.log('Inserting contacts ...')

  const start = Date.now()

  const generator = generateContacts(numContacts)
  let exit = false
  while (!exit) {
    const preparedStatement = await db.prepare('INSERT INTO contacts (name, email) VALUES (?, ?)')
    await db.run('begin transaction')

    for (let i = 0; i < blockSize; i++) {
      const next = generator.next()
      if (next.done) {
        exit = true
        break
      }
      const contact = generator.next().value
      preparedStatement.run(contact.name, contact.email)
    }

    await preparedStatement.finalize()
    await db.run('commit')
  }

  const end = Date.now()
  const elapsed = (end - start) / 1000

  console.log('Inserted contacts')
  console.log(`Insertion took ${elapsed} seconds`)
}

const queryContact = async (db) => {
  const start = Date.now()
  const res = await db.get('SELECT name FROM contacts WHERE email = ?', [`email-${numContacts}@domain.tld`])
  if (!res || !res.name) {
    console.error('Contact not found')
    process.exit(1)
  }
  const end = Date.now()
  const elapsed = (end - start) / 1000
  console.log(`Query took ${elapsed} seconds`)
}

(async () => {
  const db = await open({
    filename,
    driver: sqlite3.Database
  })
  if (shouldMigrate) {
    await migrate(db)
  }
  await insertContacts(db)
  await queryContact(db)
  await db.close()
})()
