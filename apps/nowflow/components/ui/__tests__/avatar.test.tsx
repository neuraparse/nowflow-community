/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest'
import * as React from 'react'
import '@testing-library/jest-dom'
import { render, screen, waitFor } from '@testing-library/react'
import { Avatar, AvatarFallback, AvatarImage } from '../avatar'

describe('Avatar', () => {
  describe('rendering', () => {
    it('renders the Avatar root', () => {
      render(
        <Avatar data-testid="avatar">
          <AvatarFallback>AB</AvatarFallback>
        </Avatar>
      )
      expect(screen.getByTestId('avatar')).toBeInTheDocument()
    })

    it('applies base class to Avatar root', () => {
      render(
        <Avatar data-testid="avatar">
          <AvatarFallback>AB</AvatarFallback>
        </Avatar>
      )
      expect(screen.getByTestId('avatar')).toHaveClass('workflow-editor-avatar')
    })
  })

  describe('AvatarFallback', () => {
    it('renders fallback initials when image is missing/not loaded', async () => {
      render(
        <Avatar>
          <AvatarImage src="" alt="no-image" />
          <AvatarFallback>XY</AvatarFallback>
        </Avatar>
      )
      await waitFor(() => {
        expect(screen.getByText('XY')).toBeInTheDocument()
      })
    })

    it('applies base class to AvatarFallback', async () => {
      render(
        <Avatar>
          <AvatarFallback data-testid="fallback">ZZ</AvatarFallback>
        </Avatar>
      )
      await waitFor(() => {
        expect(screen.getByTestId('fallback')).toBeInTheDocument()
      })
      expect(screen.getByTestId('fallback')).toHaveClass('workflow-editor-avatar-fallback')
    })

    it('merges custom className on AvatarFallback', async () => {
      render(
        <Avatar>
          <AvatarFallback data-testid="fallback" className="bg-red-500 extra">
            JD
          </AvatarFallback>
        </Avatar>
      )
      await waitFor(() => {
        expect(screen.getByTestId('fallback')).toBeInTheDocument()
      })
      const el = screen.getByTestId('fallback')
      expect(el).toHaveClass('bg-red-500')
      expect(el).toHaveClass('extra')
      expect(el).toHaveClass('workflow-editor-avatar-fallback')
    })
  })

  describe('className passthrough', () => {
    it('merges custom className on Avatar root', () => {
      render(
        <Avatar data-testid="avatar" className="size-12 custom-avatar">
          <AvatarFallback>AB</AvatarFallback>
        </Avatar>
      )
      const el = screen.getByTestId('avatar')
      expect(el).toHaveClass('size-12')
      expect(el).toHaveClass('custom-avatar')
      expect(el).toHaveClass('workflow-editor-avatar')
    })
  })

  describe('ref forwarding', () => {
    it('forwards ref on Avatar root', () => {
      const ref = React.createRef<HTMLSpanElement>()
      render(
        <Avatar ref={ref}>
          <AvatarFallback>AB</AvatarFallback>
        </Avatar>
      )
      expect(ref.current).not.toBeNull()
    })
  })

  describe('displayName', () => {
    it('has displayName on Avatar sub-components', () => {
      expect(Avatar.displayName).toBeTruthy()
      expect(AvatarImage.displayName).toBeTruthy()
      expect(AvatarFallback.displayName).toBeTruthy()
    })
  })
})
