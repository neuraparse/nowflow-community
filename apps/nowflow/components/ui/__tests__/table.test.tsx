/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest'
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const renderTable = () =>
  render(
    <Table className="table-extra">
      <TableCaption className="caption-extra">Users</TableCaption>
      <TableHeader className="header-extra">
        <TableRow className="header-row-extra">
          <TableHead className="head-cell-extra">Name</TableHead>
          <TableHead>Email</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody className="body-extra">
        <TableRow className="row-extra">
          <TableCell className="cell-extra">Alice</TableCell>
          <TableCell>alice@example.com</TableCell>
        </TableRow>
        <TableRow>
          <TableCell>Bob</TableCell>
          <TableCell>bob@example.com</TableCell>
        </TableRow>
      </TableBody>
      <TableFooter className="footer-extra">
        <TableRow>
          <TableCell colSpan={2}>Total: 2</TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  )

describe('Table', () => {
  it('renders a <table> wrapped in an overflow container', () => {
    const { container } = renderTable()
    const wrap = container.querySelector('.workflow-editor-table-wrap')
    expect(wrap).toBeInTheDocument()
    expect(wrap?.querySelector('table')).toBeInTheDocument()
  })

  it('renders the correct DOM shape: thead > tr > th and tbody > tr > td and tfoot', () => {
    const { container } = renderTable()
    const table = container.querySelector('table')!
    expect(table.querySelector('thead')).toBeInTheDocument()
    expect(table.querySelector('tbody')).toBeInTheDocument()
    expect(table.querySelector('tfoot')).toBeInTheDocument()
    expect(table.querySelector('caption')).toBeInTheDocument()
    expect(table.querySelectorAll('thead th')).toHaveLength(2)
    expect(table.querySelectorAll('tbody tr')).toHaveLength(2)
    expect(table.querySelectorAll('tbody td')).toHaveLength(4)
    expect(table.querySelectorAll('tfoot td')).toHaveLength(1)
  })

  it('renders cell and header text content', () => {
    renderTable()
    expect(screen.getByText('Name')).toBeInTheDocument()
    expect(screen.getByText('Email')).toBeInTheDocument()
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('alice@example.com')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
    expect(screen.getByText('Total: 2')).toBeInTheDocument()
    expect(screen.getByText('Users')).toBeInTheDocument()
  })

  it('applies workflow-editor-* base classes to each subcomponent', () => {
    const { container } = renderTable()
    expect(container.querySelector('table')).toHaveClass('workflow-editor-table')
    expect(container.querySelector('thead')).toHaveClass('workflow-editor-table-head')
    expect(container.querySelector('tbody')).toHaveClass('workflow-editor-table-body')
    expect(container.querySelector('tfoot')).toHaveClass('workflow-editor-table-footer')
    expect(container.querySelector('caption')).toHaveClass('workflow-editor-table-caption')
    expect(container.querySelector('thead th')).toHaveClass('workflow-editor-table-head-cell')
    expect(container.querySelector('tbody tr')).toHaveClass('workflow-editor-table-row')
    expect(container.querySelector('tbody td')).toHaveClass('workflow-editor-table-cell')
  })

  it('passes custom className through to each subcomponent', () => {
    const { container } = renderTable()
    expect(container.querySelector('table')).toHaveClass('table-extra')
    expect(container.querySelector('thead')).toHaveClass('header-extra')
    expect(container.querySelector('tbody')).toHaveClass('body-extra')
    expect(container.querySelector('tfoot')).toHaveClass('footer-extra')
    expect(container.querySelector('caption')).toHaveClass('caption-extra')
    expect(container.querySelector('thead tr')).toHaveClass('header-row-extra')
    expect(container.querySelector('thead th')).toHaveClass('head-cell-extra')
    expect(container.querySelector('tbody tr')).toHaveClass('row-extra')
    expect(container.querySelector('tbody td')).toHaveClass('cell-extra')
  })

  it('forwards arbitrary HTML attributes (data-*, colSpan) to cells', () => {
    render(
      <Table>
        <TableBody>
          <TableRow data-testid="row-1">
            <TableCell data-testid="cell-1" colSpan={3}>
              Cell
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    )
    expect(screen.getByTestId('row-1').tagName).toBe('TR')
    const cell = screen.getByTestId('cell-1')
    expect(cell.tagName).toBe('TD')
    expect(cell).toHaveAttribute('colspan', '3')
  })

  it('exposes the correct displayName for each subcomponent', () => {
    expect(Table.displayName).toBe('Table')
    expect(TableHeader.displayName).toBe('TableHeader')
    expect(TableBody.displayName).toBe('TableBody')
    expect(TableFooter.displayName).toBe('TableFooter')
    expect(TableRow.displayName).toBe('TableRow')
    expect(TableHead.displayName).toBe('TableHead')
    expect(TableCell.displayName).toBe('TableCell')
    expect(TableCaption.displayName).toBe('TableCaption')
  })
})
