-- Lua filter for pandoc 3.x to make tables use proportional column widths
function Table(tbl)
  local ncols = #tbl.colspecs
  if ncols > 0 then
    local w = 1.0 / ncols
    for i = 1, ncols do
      tbl.colspecs[i] = {tbl.colspecs[i][1], w}
    end
  end
  return tbl
end
