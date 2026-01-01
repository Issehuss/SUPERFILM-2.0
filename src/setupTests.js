// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import "@testing-library/jest-dom";

// Lightweight mocks to keep CRA/Jest happy with ESM-only deps and Supabase during tests.
jest.mock(
  "react-router-dom",
  () => {
    const React = require("react");
    const StubRouter = ({ children }) => <div>{children}</div>;
    const StubLink = ({ children, to = "#", end: _end, caseSensitive: _case, className, ...rest }) => {
      const safeProps = {
        href: typeof to === "string" ? to : "#",
      };
      if (typeof className === "string") {
        safeProps.className = className;
      }
      return (
        <a {...safeProps} {...rest}>
          {children}
        </a>
      );
    };
    const Route = ({ element, children }) => element || children || null;
    return {
      __esModule: true,
      BrowserRouter: StubRouter,
      MemoryRouter: StubRouter,
      Routes: ({ children }) => <>{children}</>,
      Route,
      NavLink: StubLink,
      Link: StubLink,
      Navigate: () => null,
      useNavigate: () => () => {},
      useParams: () => ({}),
      useLocation: () => ({ pathname: "/" }),
    };
  },
  { virtual: true }
);

jest.mock(
  "./supabaseClient",
  () => {
    const noop = () => {};
    const chain = () => ({
      select: () => chain(),
      eq: () => chain(),
      maybeSingle: async () => ({ data: null, error: null }),
      limit: () => chain(),
      order: () => chain(),
      range: () => chain(),
      gte: () => chain(),
      lte: () => chain(),
      maybe: () => chain(),
      upsert: async () => ({ data: null, error: null }),
      insert: async () => ({ data: null, error: null }),
      head: () => chain(),
      single: () => chain(),
      group: () => chain(),
    });

    return {
      __esModule: true,
      default: {
        auth: {
          getSession: async () => ({ data: { session: null }, error: null }),
          onAuthStateChange: () => ({
            data: {
              subscription: { unsubscribe: noop },
            },
          }),
        },
        from: () => chain(),
        functions: {
          invoke: async () => ({ data: null, error: null }),
        },
        channel: () => ({
          on: () => ({
            subscribe: () => ({}),
          }),
        }),
        removeChannel: noop,
      },
    };
  },
  { virtual: true }
);

jest.mock(
  "heic2any",
  () => {
    return jest.fn(async () => null);
  },
  { virtual: true }
);
