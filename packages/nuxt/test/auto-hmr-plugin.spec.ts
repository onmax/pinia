import { describe, expect, it } from 'vitest'
import { parseAst } from 'vite'
import { autoRegisterHMRPlugin } from '../src/auto-hmr-plugin'

function transform(code: string, id = '/app/stores/counter.js') {
  const plugin = autoRegisterHMRPlugin('/app')
  return plugin.transform.handler.call(
    { parse: parseAst } as ThisParameterType<typeof plugin.transform.handler>,
    code,
    id
  )
}

describe('automatic store HMR', () => {
  it.each([
    'const useCounter = defineStore("counter", {})',
    'export const useCounter = defineStore("counter", {})',
  ])('registers a store declared with %s', (code) => {
    const result = transform(code)

    expect(result?.code).toContain(code)
    expect(result?.code).toContain("import { acceptHMRUpdate } from 'pinia'")
    expect(result?.code).toContain(
      'import.meta.hot.accept(acceptHMRUpdate(useCounter, import.meta.hot))'
    )
    expect(() => parseAst(result!.code)).not.toThrow()
  })

  it('preserves explicit HMR registration', () => {
    expect(
      transform(
        'const useCounter = defineStore("counter", {}); import.meta.hot.accept(acceptHMRUpdate(useCounter, import.meta.hot))'
      )
    ).toBeUndefined()
  })

  it('does not register a destructured declaration', () => {
    expect(
      transform('const { useCounter } = defineStore("counter", {})')
    ).toBeUndefined()
  })

  it('does not change files outside the app', () => {
    expect(
      transform(
        'const useCounter = defineStore("counter", {})',
        '/other/store.js'
      )
    ).toBeUndefined()
  })

  it('filters out modules the handler skips', () => {
    const { filter } = autoRegisterHMRPlugin('/my.app').transform

    expect(filter.id.test('/my.app/stores/counter.js')).toBe(true)
    expect(filter.id.test('/myxapp/stores/counter.js')).toBe(false)
    expect(filter.id.test('\0virtual:/my.app/stores/counter.js')).toBe(false)
    expect(filter.code).toEqual({
      include: 'defineStore',
      exclude: 'acceptHMRUpdate',
    })
  })
})
