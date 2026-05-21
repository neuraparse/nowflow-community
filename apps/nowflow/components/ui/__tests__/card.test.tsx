/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest'
import * as React from 'react'
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../card'

describe('Card', () => {
  describe('rendering', () => {
    it('renders a full composition of sub-components', () => {
      render(
        <Card data-testid="card">
          <CardHeader data-testid="card-header">
            <CardTitle data-testid="card-title">Title text</CardTitle>
            <CardDescription data-testid="card-description">Description text</CardDescription>
          </CardHeader>
          <CardContent data-testid="card-content">Content body</CardContent>
          <CardFooter data-testid="card-footer">Footer content</CardFooter>
        </Card>
      )

      expect(screen.getByTestId('card')).toBeInTheDocument()
      expect(screen.getByTestId('card-header')).toBeInTheDocument()
      expect(screen.getByTestId('card-title')).toHaveTextContent('Title text')
      expect(screen.getByTestId('card-description')).toHaveTextContent('Description text')
      expect(screen.getByTestId('card-content')).toHaveTextContent('Content body')
      expect(screen.getByTestId('card-footer')).toHaveTextContent('Footer content')
    })

    it('renders children inside Card', () => {
      render(
        <Card>
          <span>child-element</span>
        </Card>
      )
      expect(screen.getByText('child-element')).toBeInTheDocument()
    })
  })

  describe('base classes', () => {
    it('applies base class to Card', () => {
      render(<Card data-testid="card">x</Card>)
      expect(screen.getByTestId('card')).toHaveClass('workflow-editor-card-surface')
    })

    it('applies base class to CardHeader', () => {
      render(<CardHeader data-testid="header">x</CardHeader>)
      expect(screen.getByTestId('header')).toHaveClass('workflow-editor-card-header')
    })

    it('applies base class to CardTitle', () => {
      render(<CardTitle data-testid="title">x</CardTitle>)
      expect(screen.getByTestId('title')).toHaveClass('workflow-editor-card-title')
    })

    it('applies base class to CardDescription', () => {
      render(<CardDescription data-testid="desc">x</CardDescription>)
      expect(screen.getByTestId('desc')).toHaveClass('workflow-editor-card-description')
    })

    it('applies base class to CardContent', () => {
      render(<CardContent data-testid="content">x</CardContent>)
      expect(screen.getByTestId('content')).toHaveClass('workflow-editor-card-content')
    })

    it('applies base class to CardFooter', () => {
      render(<CardFooter data-testid="footer">x</CardFooter>)
      expect(screen.getByTestId('footer')).toHaveClass('workflow-editor-card-footer')
    })
  })

  describe('className passthrough', () => {
    it('merges className on Card', () => {
      render(
        <Card data-testid="card" className="my-card extra">
          x
        </Card>
      )
      const el = screen.getByTestId('card')
      expect(el).toHaveClass('my-card')
      expect(el).toHaveClass('extra')
      expect(el).toHaveClass('workflow-editor-card-surface')
    })

    it('merges className on each sub-component', () => {
      render(
        <>
          <CardHeader data-testid="h" className="h-extra" />
          <CardTitle data-testid="t" className="t-extra" />
          <CardDescription data-testid="d" className="d-extra" />
          <CardContent data-testid="c" className="c-extra" />
          <CardFooter data-testid="f" className="f-extra" />
        </>
      )
      expect(screen.getByTestId('h')).toHaveClass('h-extra')
      expect(screen.getByTestId('t')).toHaveClass('t-extra')
      expect(screen.getByTestId('d')).toHaveClass('d-extra')
      expect(screen.getByTestId('c')).toHaveClass('c-extra')
      expect(screen.getByTestId('f')).toHaveClass('f-extra')
    })
  })

  describe('ref forwarding', () => {
    it('forwards ref to the underlying Card div', () => {
      const ref = React.createRef<HTMLDivElement>()
      render(<Card ref={ref}>ref-card</Card>)
      expect(ref.current).toBeInstanceOf(HTMLDivElement)
    })

    it('forwards ref on CardHeader, CardTitle, CardDescription, CardContent, CardFooter', () => {
      const headerRef = React.createRef<HTMLDivElement>()
      const titleRef = React.createRef<HTMLDivElement>()
      const descRef = React.createRef<HTMLDivElement>()
      const contentRef = React.createRef<HTMLDivElement>()
      const footerRef = React.createRef<HTMLDivElement>()
      render(
        <>
          <CardHeader ref={headerRef} />
          <CardTitle ref={titleRef} />
          <CardDescription ref={descRef} />
          <CardContent ref={contentRef} />
          <CardFooter ref={footerRef} />
        </>
      )
      expect(headerRef.current).toBeInstanceOf(HTMLDivElement)
      expect(titleRef.current).toBeInstanceOf(HTMLDivElement)
      expect(descRef.current).toBeInstanceOf(HTMLDivElement)
      expect(contentRef.current).toBeInstanceOf(HTMLDivElement)
      expect(footerRef.current).toBeInstanceOf(HTMLDivElement)
    })
  })

  describe('displayName', () => {
    it('has correct displayName on all sub-components', () => {
      expect(Card.displayName).toBe('Card')
      expect(CardHeader.displayName).toBe('CardHeader')
      expect(CardTitle.displayName).toBe('CardTitle')
      expect(CardDescription.displayName).toBe('CardDescription')
      expect(CardContent.displayName).toBe('CardContent')
      expect(CardFooter.displayName).toBe('CardFooter')
    })
  })
})
