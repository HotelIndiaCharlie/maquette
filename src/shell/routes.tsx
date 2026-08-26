/**
 * Routes — every route except the placeholder comes from the views registry
 * (SPEC.md §4.4). The shell owns no screens of its own.
 */
import { Route, Routes } from 'react-router-dom';
import { useRegistry, views } from '@/kernel';
import { CanvasHost, PlaceholderView } from './CanvasHost';

export function AppRoutes() {
  const defs = useRegistry(views);
  const hasRoot = defs.some((v) => v.route === '/');

  return (
    <CanvasHost>
      <Routes>
        {defs.map((def) => (
          <Route key={def.id} path={def.route} element={<def.View />} />
        ))}
        {!hasRoot && <Route path="/" element={<PlaceholderView />} />}
        <Route path="*" element={<PlaceholderView />} />
      </Routes>
    </CanvasHost>
  );
}
