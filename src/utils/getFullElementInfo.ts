export const getElementsFullInfo = (element: Element): string => {
  const elementsInfo: string[] = []
  let node: Element = element
  while (node.tagName.toLowerCase() !== 'html') {
    elementsInfo.unshift(getElementFullInfo(node))
    const parentElement = node.parentElement
    if (parentElement === null) break
    node = parentElement
  }
  return elementsInfo.join(' ')
}

export const getElementFullInfo = (element: Element): string => {
  const attributes = getElementAttributes(element)
  const identifier = getElementIdentifier(element)

  return '@' + identifier + attributes
}

export const getElementIdentifier = (clickedElement: Element): string => {
  let identifier = clickedElement.tagName.toLowerCase() + ';'
  if (clickedElement.id) {
    identifier += `#${clickedElement.id};`
  }

  if (clickedElement.classList.length > 0) {
    identifier += `.${clickedElement.classList.value.replace(/ /g, ';.')};`
  }

  return identifier
}

export const getElementAttributes = (element: Element): string => {
  const elementAttributes: string[] = []
  for (let length = element.attributes.length, i = 0; i < length; i++) {
    const { nodeName, nodeValue } = element.attributes[i]
    if (nodeName === 'id' || nodeName === 'class') continue
    elementAttributes.push(`[${nodeName}=${nodeValue}]`)
  }

  if (elementAttributes.length === 0) return ''
  return elementAttributes.join(';') + ';'
}
