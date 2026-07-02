#!/usr/bin/env sh
set -eu

REPO="Shunseii/bahar"
BIN_NAME="bahar"

detect_asset() {
  os="$(uname -s)"
  arch="$(uname -m)"

  case "$os" in
    Linux) echo "bahar-linux-x64" ;;
    Darwin)
      case "$arch" in
        arm64) echo "bahar-darwin-arm64" ;;
        *) echo "bahar-darwin-x64" ;;
      esac
      ;;
    *)
      echo "Unsupported OS: $os" >&2
      exit 1
      ;;
  esac
}

detect_install_dir() {
  if [ -n "${XDG_BIN_HOME:-}" ]; then
    echo "$XDG_BIN_HOME"
  else
    echo "$HOME/.local/bin"
  fi
}

add_to_path() {
  install_dir="$1"
  shell_name="$(basename "${SHELL:-bash}")"

  case "$shell_name" in
    fish)
      profile="$HOME/.config/fish/config.fish"
      line="fish_add_path $install_dir"
      ;;
    zsh)
      profile="$HOME/.zshrc"
      line="export PATH=\"$install_dir:\$PATH\""
      ;;
    *)
      profile="$HOME/.bashrc"
      line="export PATH=\"$install_dir:\$PATH\""
      ;;
  esac

  mkdir -p "$(dirname "$profile")"

  if [ -f "$profile" ] && grep -qF "$install_dir" "$profile"; then
    return
  fi

  {
    echo ""
    echo "# Added by the Bahar CLI installer"
    echo "$line"
  } >> "$profile"

  echo "Added $install_dir to PATH in $profile. Restart your shell or run: source $profile"
}

main() {
  asset="$(detect_asset)"
  install_dir="$(detect_install_dir)"

  echo "Fetching latest Bahar CLI release..."

  tag="$(curl -fsSL "https://api.github.com/repos/$REPO/releases" \
    | grep -m1 -o '"tag_name": *"cli-v[^"]*"' \
    | sed -E 's/.*"(cli-v[^"]+)".*/\1/')"

  if [ -z "$tag" ]; then
    echo "Could not find a CLI release. Please try again later." >&2
    exit 1
  fi

  url="https://github.com/$REPO/releases/download/$tag/$asset"

  mkdir -p "$install_dir"

  echo "Downloading $asset ($tag)..."
  curl -fsSL "$url" -o "$install_dir/$BIN_NAME"
  chmod +x "$install_dir/$BIN_NAME"

  echo "Installed to $install_dir/$BIN_NAME"

  case ":$PATH:" in
    *":$install_dir:"*) ;;
    *) add_to_path "$install_dir" ;;
  esac

  echo "Run 'bahar login' to get started."
}

main
