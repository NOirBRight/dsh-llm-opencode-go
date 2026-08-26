// @vitest-environment jsdom

import { useSyncExternalStore } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  OpenCodeGoModelPicker,
  OpenCodeGoModelPickerController,
} from '../src/client/OpenCodeGoModelPicker.tsx'
import type { OpenCodeGoModelPickerProps } from '../src/client/OpenCodeGoModelPicker.tsx'
import { en } from '../src/client/locales.ts'

afterEach(() => { cleanup() })

function renderPicker(controller: OpenCodeGoModelPickerController): void {
  const useOpenCodeGoModelPicker: OpenCodeGoModelPickerProps['useOpenCodeGoModelPicker'] = selector => selector(
    useSyncExternalStore(controller.subscribe, controller.getSnapshot),
  )
  render(<OpenCodeGoModelPicker {...({
    t: key => en[key],
    useOpenCodeGoModelPicker,
    closePicker: controller.close,
    togglePickerModel: controller.toggle,
    adoptPickerModels: controller.adopt,
  } as OpenCodeGoModelPickerProps)} />)
}

describe('OpenCodeGoModelPicker', () => {
  it('uses the frame overlay dialog lifecycle and adopts only selected models', () => {
    const controller = new OpenCodeGoModelPickerController()
    const adopted = vi.fn()
    controller.begin(adopted, new Set(['gemma3', 'qwen3']))
    controller.complete([
      { id: 'gemma3', vision: true },
      { id: 'qwen3', thinking: true },
    ])
    renderPicker(controller)

    const dialog = screen.getByRole('dialog', { name: en.pickerTitle })
    expect(dialog.parentElement?.parentElement).toBe(document.body)
    const choices = screen.getAllByRole<HTMLInputElement>('checkbox')
    expect(choices.map(choice => choice.checked)).toEqual([true, true])
    fireEvent.click(choices[1] as HTMLInputElement)
    fireEvent.click(screen.getByRole('button', { name: en.applySelected }))

    expect(adopted).toHaveBeenCalledWith([{ id: 'gemma3', vision: true }])
    expect(screen.queryByRole('dialog', { name: en.pickerTitle })).toBeNull()
  })

  it('can apply an empty selection to clear the catalog', () => {
    const controller = new OpenCodeGoModelPickerController()
    const adopted = vi.fn()
    controller.begin(adopted, new Set(['gemma3']))
    controller.complete([{ id: 'gemma3' }])
    renderPicker(controller)

    fireEvent.click(screen.getByRole<HTMLInputElement>('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: en.applySelected }))

    expect(adopted).toHaveBeenCalledWith([])
  })
  it('matches the current model selection when discovery completes', () => {
    const controller = new OpenCodeGoModelPickerController()
    controller.begin(vi.fn(), new Set(['qwen3']))
    controller.complete([
      { id: 'gemma3' },
      { id: 'qwen3' },
    ])
    renderPicker(controller)

    const choices = screen.getAllByRole<HTMLInputElement>('checkbox')
    expect(choices.map(choice => choice.checked)).toEqual([false, true])
  })
  it('opens immediately with loading and keeps failures visible', () => {
    const controller = new OpenCodeGoModelPickerController()
    controller.begin(vi.fn())
    renderPicker(controller)

    expect(screen.getByRole('dialog', { name: en.pickerTitle }).getAttribute('aria-busy')).toBe('true')
    expect(screen.getByRole('status').textContent).toBe(en.pickerLoading)
    expect(screen.getByRole<HTMLButtonElement>('button', { name: en.applySelected }).disabled).toBe(true)

    act(() => { controller.fail('could not reach endpoint') })

    expect(screen.getByRole('alert').textContent).toBe('could not reach endpoint')
  })

  it('closes on Escape without adopting', () => {
    const controller = new OpenCodeGoModelPickerController()
    const adopted = vi.fn()
    controller.begin(adopted)
    renderPicker(controller)

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(adopted).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog', { name: en.pickerTitle })).toBeNull()
  })
})
