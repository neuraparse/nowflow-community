/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest'
import * as React from 'react'
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import { Alert, AlertDescription, AlertTitle } from '../alert'

describe('Alert', () => {
  describe('rendering', () => {
    it('renders Alert with Title and Description', () => {
      render(
        <Alert>
          <AlertTitle>Heads up</AlertTitle>
          <AlertDescription>You can add components to your app.</AlertDescription>
        </Alert>
      )
      expect(screen.getByText('Heads up')).toBeInTheDocument()
      expect(screen.getByText('You can add components to your app.')).toBeInTheDocument()
    })

    it('renders AlertTitle as an h5 heading', () => {
      render(<AlertTitle>Title</AlertTitle>)
      const heading = screen.getByText('Title')
      expect(heading.tagName).toBe('H5')
    })

    it('renders AlertDescription as a div', () => {
      render(<AlertDescription data-testid="desc">desc body</AlertDescription>)
      expect(screen.getByTestId('desc').tagName).toBe('DIV')
    })
  })

  describe('aria role', () => {
    it('has role="alert"', () => {
      render(<Alert>Something happened</Alert>)
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })
  })

  describe('base classes', () => {
    it('applies base class to Alert', () => {
      render(<Alert data-testid="alert">x</Alert>)
      expect(screen.getByTestId('alert')).toHaveClass('workflow-editor-alert')
    })

    it('applies default variant (no destructive class)', () => {
      render(<Alert data-testid="alert">x</Alert>)
      expect(screen.getByTestId('alert')).not.toHaveClass('workflow-editor-alert-destructive')
    })

    it('applies base class to AlertTitle', () => {
      render(<AlertTitle data-testid="title">x</AlertTitle>)
      expect(screen.getByTestId('title')).toHaveClass('workflow-editor-alert-title')
    })

    it('applies base class to AlertDescription', () => {
      render(<AlertDescription data-testid="desc">x</AlertDescription>)
      expect(screen.getByTestId('desc')).toHaveClass('workflow-editor-alert-description')
    })
  })

  describe('variants', () => {
    it('applies destructive variant class when variant="destructive"', () => {
      render(
        <Alert data-testid="alert" variant="destructive">
          x
        </Alert>
      )
      expect(screen.getByTestId('alert')).toHaveClass('workflow-editor-alert-destructive')
    })

    it('applies default variant class when variant="default"', () => {
      render(
        <Alert data-testid="alert" variant="default">
          x
        </Alert>
      )
      const el = screen.getByTestId('alert')
      expect(el).toHaveClass('workflow-editor-alert-default')
      expect(el).not.toHaveClass('workflow-editor-alert-destructive')
    })
  })

  describe('className passthrough', () => {
    it('merges className on Alert', () => {
      render(
        <Alert data-testid="alert" className="alert-extra">
          x
        </Alert>
      )
      const el = screen.getByTestId('alert')
      expect(el).toHaveClass('alert-extra')
      expect(el).toHaveClass('workflow-editor-alert')
    })

    it('merges className on AlertTitle and AlertDescription', () => {
      render(
        <>
          <AlertTitle data-testid="title" className="t-extra">
            t
          </AlertTitle>
          <AlertDescription data-testid="desc" className="d-extra">
            d
          </AlertDescription>
        </>
      )
      expect(screen.getByTestId('title')).toHaveClass('t-extra')
      expect(screen.getByTestId('desc')).toHaveClass('d-extra')
    })
  })

  describe('ref forwarding', () => {
    it('forwards ref on Alert', () => {
      const ref = React.createRef<HTMLDivElement>()
      render(<Alert ref={ref}>x</Alert>)
      expect(ref.current).toBeInstanceOf(HTMLDivElement)
    })

    it('forwards ref on AlertTitle (heading element)', () => {
      const ref = React.createRef<HTMLParagraphElement>()
      render(<AlertTitle ref={ref}>x</AlertTitle>)
      expect(ref.current).not.toBeNull()
      expect(ref.current?.tagName).toBe('H5')
    })

    it('forwards ref on AlertDescription', () => {
      const ref = React.createRef<HTMLParagraphElement>()
      render(<AlertDescription ref={ref}>x</AlertDescription>)
      expect(ref.current).not.toBeNull()
    })
  })

  describe('displayName', () => {
    it('has correct displayName on all sub-components', () => {
      expect(Alert.displayName).toBe('Alert')
      expect(AlertTitle.displayName).toBe('AlertTitle')
      expect(AlertDescription.displayName).toBe('AlertDescription')
    })
  })
})
