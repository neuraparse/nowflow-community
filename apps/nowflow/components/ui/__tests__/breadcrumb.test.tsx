/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest'
import * as React from 'react'
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '../breadcrumb'

describe('Breadcrumb', () => {
  describe('root Breadcrumb', () => {
    it('renders a nav with breadcrumb aria-label', () => {
      render(
        <Breadcrumb>
          <BreadcrumbList />
        </Breadcrumb>
      )
      const nav = screen.getByRole('navigation')
      expect(nav).toBeInTheDocument()
      expect(nav).toHaveAttribute('aria-label', 'breadcrumb')
      expect(nav.tagName).toBe('NAV')
    })

    it('forwards ref to the underlying nav element', () => {
      const ref = React.createRef<HTMLElement>()
      render(
        <Breadcrumb ref={ref}>
          <BreadcrumbList />
        </Breadcrumb>
      )
      expect(ref.current).toBeInstanceOf(HTMLElement)
      expect(ref.current?.tagName).toBe('NAV')
    })

    it('forwards arbitrary data attributes', () => {
      render(
        <Breadcrumb data-testid="crumb">
          <BreadcrumbList />
        </Breadcrumb>
      )
      expect(screen.getByTestId('crumb')).toBeInTheDocument()
    })
  })

  describe('BreadcrumbList', () => {
    it('renders as an ordered list', () => {
      render(
        <Breadcrumb>
          <BreadcrumbList data-testid="list" />
        </Breadcrumb>
      )
      const list = screen.getByTestId('list')
      expect(list.tagName).toBe('OL')
    })

    it('applies base classes', () => {
      render(
        <Breadcrumb>
          <BreadcrumbList data-testid="list" />
        </Breadcrumb>
      )
      const list = screen.getByTestId('list')
      expect(list).toHaveClass('workflow-editor-breadcrumb')
      expect(list).toHaveClass('flex')
    })

    it('merges custom className', () => {
      render(
        <Breadcrumb>
          <BreadcrumbList className="custom-list" data-testid="list" />
        </Breadcrumb>
      )
      const list = screen.getByTestId('list')
      expect(list).toHaveClass('custom-list')
      expect(list).toHaveClass('workflow-editor-breadcrumb')
    })
  })

  describe('BreadcrumbItem', () => {
    it('renders as a list item', () => {
      render(
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem data-testid="item">Home</BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      )
      const item = screen.getByTestId('item')
      expect(item.tagName).toBe('LI')
      expect(item).toHaveTextContent('Home')
    })

    it('merges custom className', () => {
      render(
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem className="custom-item" data-testid="item">
              Home
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      )
      const item = screen.getByTestId('item')
      expect(item).toHaveClass('custom-item')
      expect(item).toHaveClass('inline-flex')
    })
  })

  describe('BreadcrumbLink', () => {
    it('renders an anchor by default', () => {
      render(<BreadcrumbLink href="/home">Home</BreadcrumbLink>)
      const link = screen.getByRole('link', { name: 'Home' })
      expect(link.tagName).toBe('A')
      expect(link).toHaveAttribute('href', '/home')
    })

    it('renders with asChild to compose a custom element', () => {
      render(
        <BreadcrumbLink asChild>
          <a href="/about" data-testid="custom-link">
            About
          </a>
        </BreadcrumbLink>
      )
      const link = screen.getByTestId('custom-link')
      expect(link.tagName).toBe('A')
      expect(link).toHaveAttribute('href', '/about')
      expect(link).toHaveClass('workflow-editor-breadcrumb-link')
    })

    it('applies base classes and merges custom className', () => {
      render(
        <BreadcrumbLink href="/home" className="custom-link">
          Home
        </BreadcrumbLink>
      )
      const link = screen.getByRole('link', { name: 'Home' })
      expect(link).toHaveClass('custom-link')
      expect(link).toHaveClass('workflow-editor-breadcrumb-link')
    })
  })

  describe('BreadcrumbPage', () => {
    it('renders a span marking the current page', () => {
      render(<BreadcrumbPage>Current</BreadcrumbPage>)
      const page = screen.getByText('Current')
      expect(page.tagName).toBe('SPAN')
      expect(page).toHaveAttribute('role', 'link')
      expect(page).toHaveAttribute('aria-current', 'page')
      expect(page).toHaveAttribute('aria-disabled', 'true')
    })

    it('applies base classes and merges custom className', () => {
      render(<BreadcrumbPage className="custom-page">Current</BreadcrumbPage>)
      const page = screen.getByText('Current')
      expect(page).toHaveClass('custom-page')
      expect(page).toHaveClass('workflow-editor-breadcrumb-page')
    })
  })

  describe('BreadcrumbSeparator', () => {
    it('renders a presentation li with hidden aria', () => {
      render(
        <ol>
          <BreadcrumbSeparator data-testid="sep" />
        </ol>
      )
      const sep = screen.getByTestId('sep')
      expect(sep.tagName).toBe('LI')
      expect(sep).toHaveAttribute('role', 'presentation')
      expect(sep).toHaveAttribute('aria-hidden', 'true')
    })

    it('renders a default ChevronRight icon when no children provided', () => {
      render(
        <ol>
          <BreadcrumbSeparator data-testid="sep" />
        </ol>
      )
      const sep = screen.getByTestId('sep')
      expect(sep.querySelector('svg')).toBeInTheDocument()
    })

    it('renders custom children when provided', () => {
      render(
        <ol>
          <BreadcrumbSeparator data-testid="sep">/</BreadcrumbSeparator>
        </ol>
      )
      const sep = screen.getByTestId('sep')
      expect(sep).toHaveTextContent('/')
      expect(sep.querySelector('svg')).not.toBeInTheDocument()
    })

    it('merges custom className', () => {
      render(
        <ol>
          <BreadcrumbSeparator className="custom-sep" data-testid="sep" />
        </ol>
      )
      expect(screen.getByTestId('sep')).toHaveClass('custom-sep')
    })
  })

  describe('BreadcrumbEllipsis', () => {
    it('renders a presentation span with hidden aria', () => {
      render(<BreadcrumbEllipsis data-testid="ellipsis" />)
      const ellipsis = screen.getByTestId('ellipsis')
      expect(ellipsis.tagName).toBe('SPAN')
      expect(ellipsis).toHaveAttribute('role', 'presentation')
      expect(ellipsis).toHaveAttribute('aria-hidden', 'true')
    })

    it('includes an sr-only "More" label', () => {
      render(<BreadcrumbEllipsis data-testid="ellipsis" />)
      expect(screen.getByText('More')).toBeInTheDocument()
      expect(screen.getByText('More')).toHaveClass('sr-only')
    })

    it('renders a MoreHorizontal icon', () => {
      render(<BreadcrumbEllipsis data-testid="ellipsis" />)
      const ellipsis = screen.getByTestId('ellipsis')
      expect(ellipsis.querySelector('svg')).toBeInTheDocument()
    })

    it('merges custom className', () => {
      render(<BreadcrumbEllipsis className="custom-ellipsis" data-testid="ellipsis" />)
      expect(screen.getByTestId('ellipsis')).toHaveClass('custom-ellipsis')
    })
  })

  describe('full breadcrumb composition', () => {
    it('renders items, separators, and current page in order', () => {
      render(
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/">Home</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="/docs">Docs</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Current</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      )

      // Navigable links
      const homeLink = screen.getByRole('link', { name: 'Home' })
      const docsLink = screen.getByRole('link', { name: 'Docs' })
      expect(homeLink).toHaveAttribute('href', '/')
      expect(docsLink).toHaveAttribute('href', '/docs')

      // Current page
      const currentPage = screen.getByText('Current')
      expect(currentPage).toHaveAttribute('aria-current', 'page')

      // Structure: OL contains 5 LIs (3 items + 2 separators)
      const list = screen.getByRole('navigation').querySelector('ol')
      expect(list).not.toBeNull()
      expect(list?.children.length).toBe(5)
    })

    it('supports ellipsis for collapsed paths', () => {
      render(
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/">Home</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbEllipsis />
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Current</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      )

      expect(screen.getByRole('link', { name: 'Home' })).toBeInTheDocument()
      expect(screen.getByText('More')).toBeInTheDocument()
      expect(screen.getByText('Current')).toHaveAttribute('aria-current', 'page')
    })
  })
})
